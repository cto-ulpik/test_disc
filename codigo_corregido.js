// 2) Inicializar una sola vez
// const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables globales para el nuevo sistema de bloques
let shuffledBlocks = [];
let userResponses = []; // Array de objetos {most: dimension, least: dimension}
let currentBlockIndex = 0;
const blocksPerPage = 1; // Mostrar un bloque a la vez
let userEmail = ''; // Email del usuario para pre-llenar formulario de Bitrix24

// Prueba de Toastify
console.log('Toastify disponible:', typeof Toastify !== 'undefined');
if (typeof Toastify !== 'undefined') {
  console.log('Toastify cargado correctamente');
} else {
  console.error('Toastify no está disponible');
}

// Utilidad para mostrar estado arriba del wrapper
function paintStatus(msg, color) {
  const wrapper = document.getElementById("eneagram-test-wrapper");
  if (!wrapper) return;
  let el = document.getElementById("firestore-conn-msg");
  if (!el) {
    el = document.createElement("div");
    el.id = "firestore-conn-msg";
    el.style.fontSize = "0.95em";
    el.style.marginBottom = "8px";
    wrapper.insertBefore(el, wrapper.firstChild);
  }
  el.style.color = color;
  el.textContent = msg;
}

// 3) Autenticar (anónimo) para pasar reglas que exigen auth
//    Si luego usarás email/password o Google, cambia esta parte.
let firebaseAvailable = false;
let firebaseInitialized = false;

// Función para inicializar Firebase de manera asíncrona
async function initializeFirebase() {
  try {
    console.log("Iniciando autenticación anónima...");
    const userCredential = await auth.signInAnonymously();
    console.log("Usuario autenticado:", userCredential.user.uid);
    
    firebaseAvailable = true;
    firebaseInitialized = true;
    console.log("Firebase autenticado correctamente");
    return true;
  } catch (e) {
    console.error("Error en autenticación Firebase:", e);
    console.error("Código de error:", e.code);
    console.error("Mensaje de error:", e.message);
    
    firebaseAvailable = false;
    firebaseInitialized = true;
    // paintStatus(
    //   `⚠ Error de Firebase: ${e.code || e.message}. Modo offline activado.`,
    //   "#e53935"
    // );
    return false;
  }
}

// 4) Al cargar el DOM, probar lectura
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar Firebase primero
  await initializeFirebase();
  
  if (!firebaseAvailable) {
    // paintStatus("⚠ Modo offline: Los resultados se guardarán localmente", "#f57c00");
    return;
  }

  try {
    // Esperar a que el usuario esté autenticado
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          console.log("Usuario autenticado, probando Firestore...");
          const uid = user.uid;
          
          // Probar escritura en Firestore
          const testDoc = {
            test: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user_id: uid
          };
          
          console.log("Intentando escribir documento de prueba...");
          // const docRef = await db.collection("disc").add(testDoc);
          // console.log("Documento de prueba creado:", docRef.id);
          
          // Probar lectura
          console.log("Intentando leer documento...");
          const q = db
            .collection("disc")
            .where("user_id", "==", uid)
            .limit(1);
          const querySnapshot = await q.get();
          console.log("Consulta exitosa, documentos encontrados:", querySnapshot.size);
          
          // Limpiar documento de prueba
          // await docRef.delete();
          console.log("Documento de prueba eliminado");
          
          // paintStatus("✔ Conectado a Firestore", "#388e3c");
          console.log("Conexión a Firestore exitosa");
        } catch (error) {
          console.error("Error en prueba de Firestore:", error);
          console.error("Código de error:", error.code);
          console.error("Mensaje:", error.message);
          
          // Solo marcar como no disponible si es un error crítico
          if (error.code === "unavailable" || error.code === "unauthenticated") {
            firebaseAvailable = false;
            // paintStatus(
            //   `⚠ Error crítico de Firestore: ${error.code}. Modo offline activado.`,
            //   "#e53935"
            // );
          } else if (error.code === "permission-denied") {
            // Para errores de permisos, mantener Firebase disponible pero mostrar advertencia
            console.warn("Advertencia: Permisos limitados en Firestore, pero continuando...");
            // paintStatus(
            //   "⚠ Advertencia: Permisos limitados en Firestore. Algunas operaciones pueden fallar.",
            //   "#f57c00"
            // );
          } else {
            // Para otros errores, mantener Firebase disponible
            console.warn("Error no crítico en Firestore, continuando...");
            // paintStatus(
            //   `⚠ Advertencia: ${error.code || error.message}. Continuando con limitaciones.`,
            //   "#f57c00"
            // );
          }
        }
      } else {
        console.log("No hay usuario autenticado");
        firebaseAvailable = false;
        // paintStatus("⚠ No autenticado. Modo offline activado.", "#e53935");
      }
    });
  } catch (error) {
    console.error("Error de inicialización de Firebase:", error);
    firebaseAvailable = false;
    // paintStatus("⚠ Error de inicialización de Firebase. Modo offline activado.", "#e53935");
  }
});

// 5) Guardar resultado (incluye user_id para cumplir reglas)
let firestoreDocRef = null;
async function crearDocumentoFirestore(email) {
  if (!firebaseAvailable) {
    console.log("Firebase no disponible, guardando localmente");
    return;
  }
  
  try {
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    if (!uid) {
      throw new Error("Usuario no autenticado");
    }
    
    const payload = {
      email,
      user_id: uid,
      consentimiento: true,
      fecha_creacion: firebase.firestore.FieldValue.serverTimestamp(),
      version_test: "disc_v2.0",
      respuestas: {},
    };
    
    console.log("Creando documento en Firestore...");
    firestoreDocRef = await db.collection("disc").add(payload);
    console.log("Documento creado en Firestore:", firestoreDocRef.id);
    return firestoreDocRef;
  } catch (error) {
    console.error("Error creando documento en Firestore:", error);
    console.error("Código de error:", error.code);
    firebaseAvailable = false;
    throw error;
  }
}

async function actualizarRespuestasFirestore() {
  if (!firebaseAvailable) {
    console.log("Firebase no disponible, no se pueden actualizar respuestas");
    return;
  }
  
  if (!firestoreDocRef) {
    console.log("No hay referencia de documento, no se pueden actualizar respuestas");
    return;
  }
  
  try {
    const respuestasObj = {};
    let respuestasCount = 0;
    
    userResponses.forEach((resp, idx) => {
      if (resp !== null && resp.most !== null && resp.least !== null) {
        respuestasObj[`p${idx + 1}`] = {
          most: resp.most,
          least: resp.least,
          mostDimension: resp.mostDimension,
          leastDimension: resp.leastDimension
        };
        respuestasCount++;
      }
    });
    
    console.log(`Actualizando ${respuestasCount} respuestas en Firestore...`);
    console.log("Objeto de respuestas:", respuestasObj);
    
    await firestoreDocRef.update({ respuestas: respuestasObj });
    console.log("✓ Respuestas actualizadas exitosamente en Firestore");
    
    // Verificar que se guardó correctamente
    const docSnapshot = await firestoreDocRef.get();
    if (docSnapshot.exists) {
      const data = docSnapshot.data();
      console.log("Datos guardados en Firestore:", data);
    }
  } catch (error) {
    console.error("Error actualizando respuestas en Firestore:", error);
    console.error("Código de error:", error.code);
    console.error("Mensaje:", error.message);
    
    // Solo desactivar Firebase si es un error crítico
    if (error.code === "unavailable" || error.code === "unauthenticated") {
      firebaseAvailable = false;
      console.error("Firebase desactivado debido a error crítico");
    } else {
      console.warn("Error no crítico, Firebase sigue disponible");
    }
  }
}

async function actualizarResultadoFirestore(resultado) {
  if (!firebaseAvailable) {
    console.log("Firebase no disponible, no se puede actualizar resultado");
    return;
  }
  
  if (!firestoreDocRef) {
    console.log("No hay referencia de documento, no se puede actualizar resultado");
    return;
  }
  
  try {
    console.log("Actualizando resultado en Firestore:", resultado);
    await firestoreDocRef.update({ resultado });
    console.log("✓ Resultado actualizado exitosamente en Firestore");
    
    // Verificar que se guardó correctamente
    const docSnapshot = await firestoreDocRef.get();
    if (docSnapshot.exists) {
      const data = docSnapshot.data();
      console.log("Datos finales en Firestore:", data);
    }
  } catch (error) {
    console.error("Error actualizando resultado en Firestore:", error);
    console.error("Código de error:", error.code);
    console.error("Mensaje:", error.message);
    
    // Solo desactivar Firebase si es un error crítico
    if (error.code === "unavailable" || error.code === "unauthenticated") {
      firebaseAvailable = false;
      console.error("Firebase desactivado debido a error crítico");
    } else {
      console.warn("Error no crítico, Firebase sigue disponible");
    }
  }
}

// Función de diagnóstico de Firebase
function diagnosticarFirebase() {
  console.log("=== DIAGNÓSTICO DE FIREBASE ===");
  console.log("Firebase disponible:", firebaseAvailable);
  console.log("Firebase inicializado:", firebaseInitialized);
  console.log("Usuario actual:", auth.currentUser);
  console.log("UID del usuario:", auth.currentUser ? auth.currentUser.uid : "No autenticado");
  console.log("Referencia del documento:", firestoreDocRef ? firestoreDocRef.id : "No creado");
  
  // Verificar configuración
  console.log("Configuración de Firebase:");
  console.log("- Project ID:", firebase.app().options.projectId);
  console.log("- Auth Domain:", firebase.app().options.authDomain);
  
  // Probar conectividad básica
  if (firebaseAvailable) {
    console.log("Probando conectividad...");
    db.collection("test").doc("connectivity").get()
      .then(() => console.log("✓ Conectividad básica OK"))
      .catch(err => console.error("✗ Error de conectividad:", err));
  }
  console.log("=== FIN DIAGNÓSTICO ===");
}

// Función para guardar resultados localmente como respaldo
function guardarResultadoLocal(email, resultado, respuestas) {
  try {
    const datos = {
      email,
      resultado,
      respuestas,
      fecha: new Date().toISOString(),
      version: "disc_v2.0"
    };
    
    // Guardar en localStorage
    const key = `disc_result_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(datos));
    
    // También mostrar en consola para fácil acceso
    console.log("Resultado guardado localmente:", datos);
    
    // Mostrar mensaje al usuario
    const alertDiv = document.getElementById("alert-message");
    if (alertDiv) {
      alertDiv.textContent = "Resultado guardado localmente (Firebase no disponible)";
      alertDiv.style.display = "block";
      alertDiv.style.background = "#d4edda";
      alertDiv.style.color = "#155724";
      alertDiv.style.border = "1px solid #c3e6cb";
      setTimeout(() => {
        alertDiv.style.display = "none";
      }, 5000);
    }
  } catch (error) {
    console.error("Error guardando localmente:", error);
  }
}

// Función para mostrar modal de email al final del test
function mostrarModalEmail() {
  return new Promise((resolve) => {
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'email-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
      backdrop-filter: blur(10px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: modalFadeIn 0.3s ease-out;
    `;

    // Crear contenido del modal
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%);
      backdrop-filter: blur(20px);
      padding: 40px;
      border-radius: 24px;
      box-shadow: 
        0 20px 40px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      max-width: 450px;
      width: 90%;
      text-align: center;
      position: relative;
      overflow: hidden;
      animation: modalSlideIn 0.4s ease-out;
    `;

    modalContent.innerHTML = `
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #1982C4 0%, #FF595E 100%); border-radius: 24px 24px 0 0;"></div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="margin-top: 0; background: linear-gradient(135deg, #1982C4 0%, #FF595E 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 1.8em; font-weight: 700; margin-bottom: 10px;">¡Casi terminamos!</h3>
        <p style="color: #4a5568; margin-bottom: 0; font-size: 1.1em;">Para ver tus resultados, necesitamos tu email y que aceptes los términos:</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <input type="email" id="modal-email-input" placeholder="tu@email.com" 
               style="width: 100%; padding: 16px 20px; border: 2px solid rgba(25, 130, 196, 0.2); border-radius: 12px; font-size: 1em; margin-bottom: 0; box-sizing: border-box; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(5px); transition: all 0.3s ease; outline: none;">
      </div>
      
      <div style="text-align: left; margin-bottom: 25px; background: linear-gradient(135deg, rgba(25, 130, 196, 0.05) 0%, rgba(255, 89, 94, 0.05) 100%); border-radius: 16px; padding: 20px; border: 1px solid rgba(25, 130, 196, 0.1);">
        <div style="margin-bottom: 15px;">
          <label for="modal-consentimiento-checkbox" style="display: flex; align-items: flex-start; gap: 12px; font-size: 0.95em; color: #4a5568; cursor: pointer; line-height: 1.5;">
            <input type="checkbox" id="modal-consentimiento-checkbox" required 
                   style="margin: 0; width: 18px; height: 18px; accent-color: #1982C4; flex-shrink: 0; margin-top: 2px;">
            <span>
              Acepto los
              <a href="https://ulpik.com/wp-content/uploads/2025/09/Ulpik-Terminos-y-Condiciones-2025.-1.pdf" 
                 target="_blank" rel="noopener noreferrer" style="color: #1982C4; text-decoration: underline; font-weight: 600;">
                términos y condiciones
              </a>
              y el uso de mis datos para este test.
            </span>
          </label>
        </div>
        <div>
          <label for="modal-promociones-checkbox" style="display: flex; align-items: flex-start; gap: 12px; font-size: 0.95em; color: #4a5568; cursor: pointer; line-height: 1.5;">
            <input type="checkbox" id="modal-promociones-checkbox"
                   style="margin: 0; width: 18px; height: 18px; accent-color: #1982C4; flex-shrink: 0; margin-top: 2px;">
            <span>Al hacer clic, autorizo recibir correos y promociones.</span>
          </label>
        </div>
      </div>
      
      <div style="font-size: 0.9em; color: #718096; margin-bottom: 25px; font-style: italic; background: rgba(25, 130, 196, 0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(25, 130, 196, 0.1);">
        Este test es personalizado para ti. Usamos tu correo solo para identificarte y mejorar tu experiencia. No compartimos tus datos.
      </div>
      
      <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
        <div id="modal-cancel-btn" style="padding: 14px 28px; border: 2px solid rgba(25, 130, 196, 0.3); background: rgba(255, 255, 255, 0.8); color: #4a5568; border-radius: 12px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; backdrop-filter: blur(5px); text-align: center; user-select: none;">Cancelar</div>
        <div id="modal-complete-btn" style="padding: 14px 28px; border: 2px solid rgba(25, 130, 196, 0.3); background: rgba(25, 130, 196, 0.1); color: #1982C4; border-radius: 12px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; display: none; text-align: center; user-select: none;">Completar Preguntas</div>
        <div id="modal-save-btn" style="padding: 14px 28px; border: none; background: linear-gradient(135deg, #1982C4 0%, #FF595E 100%); color: white; border-radius: 12px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(25, 130, 196, 0.3); position: relative; overflow: hidden; text-align: center; user-select: none;">Ver resultados</div>
      </div>
      <div id="modal-error" style="color: #e53e3e; margin-top: 15px; display: none; font-size: 0.9em; background: rgba(229, 62, 62, 0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(229, 62, 62, 0.2);"></div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const emailInput = modal.querySelector('#modal-email-input');
    const saveBtn = modal.querySelector('#modal-save-btn');
    const cancelBtn = modal.querySelector('#modal-cancel-btn');
    const completeBtn = modal.querySelector('#modal-complete-btn');
    const errorDiv = modal.querySelector('#modal-error');
    const consentimientoCheckbox = modal.querySelector('#modal-consentimiento-checkbox');
    const promocionesCheckbox = modal.querySelector('#modal-promociones-checkbox');

    // Función para validar el formulario completo
    function validateForm() {
      const email = emailInput.value.trim();
      const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
      const consentimientoValid = consentimientoCheckbox.checked;
      
      // Verificar si hay preguntas sin responder
      const preguntasSinResponder = userResponses.filter(response => response === null).length;
      const todasRespondidas = preguntasSinResponder === 0;
      
      // Mostrar/ocultar botón "Completar Preguntas"
      if (!todasRespondidas) {
        completeBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
      } else {
        completeBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
      }
      
      // Validar que todos los campos estén completos (promociones es opcional)
      const todoValido = emailValid && consentimientoValid && todasRespondidas;
      
      if (todoValido) {
        emailInput.style.borderColor = '#2ecc40';
        saveBtn.disabled = false;
        errorDiv.style.display = 'none';
      } else {
        emailInput.style.borderColor = email.length > 0 && !emailValid ? '#e74c3c' : 'rgba(25, 130, 196, 0.2)';
        saveBtn.disabled = true;
        errorDiv.style.display = 'none'; // Ocultar mensajes de error en validación en tiempo real
      }
    }

    // Validación en tiempo real
    emailInput.addEventListener('input', validateForm);
    
    // Validación de checkboxes
    consentimientoCheckbox.addEventListener('change', validateForm);
    promocionesCheckbox.addEventListener('change', validateForm);

    // Event listeners
    saveBtn.addEventListener('click', async function() {
      console.log('Botón Ver resultados presionado'); // Debug
      
      // Prueba simple de Toastify
      if (typeof Toastify !== 'undefined') {
        console.log('Toastify está disponible, mostrando notificación de prueba');
       
        // Continuar con la lógica normal después de mostrar la prueba
      } else {
        console.error('Toastify no está disponible');
        alert('Toastify no está disponible');
        return;
      }
      
      const email = emailInput.value.trim();
      const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
      const consentimientoValid = consentimientoCheckbox.checked;
      const promocionesValid = promocionesCheckbox.checked;
      
      // Validar que todas las preguntas estén respondidas
      const preguntasSinResponder = [];
      for (let i = 0; i < userResponses.length; i++) {
        if (userResponses[i] === null) {
          const preguntaNum = i + 1;
          const pagina = Math.ceil(preguntaNum / questionsPerPage);
          preguntasSinResponder.push({ numero: preguntaNum, pagina: pagina });
        }
      }
      
      if (preguntasSinResponder.length > 0) {
        const preguntasLista = preguntasSinResponder.slice(0, 5).map(p => `• Pregunta ${p.numero} (Página ${p.pagina})`).join('\n');
        const mensajeAdicional = preguntasSinResponder.length > 5 ? `\n• Y ${preguntasSinResponder.length - 5} preguntas más...` : '';
        
        console.log('Mostrando notificación de preguntas faltantes'); // Debug
        Toastify({
          text: `❓ Faltan ${preguntasSinResponder.length} pregunta${preguntasSinResponder.length > 1 ? 's' : ''} por responder. Debes completar todas antes de ver los resultados.`,
          duration: 5000,
          gravity: "top",
          position: "center",
          backgroundColor: "linear-gradient(to right, #f59e0b, #fbbf24)",
          className: "toastify-warning",
          style: {
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)"
          }
        }).showToast();
        return;
      }
      
      if (!emailValid) {
        console.log('Mostrando notificación de email inválido'); // Debug
        Toastify({
          text: "📧 Por favor ingresa un email válido. Ejemplos: usuario@email.com, nombre.apellido@empresa.com",
          duration: 5000,
          gravity: "top",
          position: "center",
          backgroundColor: "linear-gradient(to right, #f59e0b, #fbbf24)",
          className: "toastify-warning",
          style: {
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)"
          }
        }).showToast();
        return;
      }
      
      if (!consentimientoValid) {
        const faltantes = [];
        if (!consentimientoValid) faltantes.push('• Términos y condiciones');
        
        console.log('Mostrando notificación de checkboxes faltantes'); // Debug
        const faltantesTexto = faltantes.join(', ');
        Toastify({
          text: `📋 Antes de ver tus resultados, debes aceptar: ${faltantesTexto}. Sin esto no podrás ver tus resultados.`,
          duration: 5000,
          gravity: "top",
          position: "center",
          backgroundColor: "linear-gradient(to right, #f59e0b, #fbbf24)",
          className: "toastify-warning",
          style: {
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)"
          }
        }).showToast();
        return;
      }
      
      // Si todo está válido, guardar en Firestore y proceder
      const acceptsPromotions = promocionesCheckbox.checked;
      
      // Guardar el email globalmente para pre-llenar el formulario de Bitrix24
      userEmail = email;
      console.log('✅ Email guardado para pre-llenar formulario de Bitrix24:', userEmail);
      
      await updateFirestoreWithEmail(email, acceptsPromotions);
      document.body.removeChild(modal);
      resolve({ email, acceptsPromotions });
    });

    cancelBtn.addEventListener('click', function() {
      document.body.removeChild(modal);
      resolve(null);
    });

    completeBtn.addEventListener('click', function() {
      // Cerrar el modal y volver a las preguntas
      document.body.removeChild(modal);
      resolve('complete');
    });

    // Cerrar con ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        resolve(null);
      }
    });

    // Validación inicial
    validateForm();
    
    // Focus en el input de email
    setTimeout(() => emailInput.focus(), 100);
  });
}

// Seleccionar elementos DENTRO del wrapper para evitar conflictos
const wrapper = document.getElementById("eneagram-test-wrapper");
if (!wrapper) {
  console.error("Contenedor principal #eneagram-test-wrapper no encontrado.");
}

const quizContainer = wrapper.querySelector("#quiz-container");
const quizForm = wrapper.querySelector("#quiz-form");
const resultsTextDiv = wrapper.querySelector("#results-text");
const resultsContainer = wrapper.querySelector("#results-container");
const alertMessageDiv = wrapper.querySelector("#alert-message");
const paginationControlsDiv = wrapper.querySelector("#pagination-controls");
const submitBtn = wrapper.querySelector("#submit-btn");
const startTestContainer = wrapper.querySelector("#start-test-container");
const startTestBtn = wrapper.querySelector("#start-test-btn");
const typeDescriptions = wrapper.querySelectorAll(".type-description");
const restartTestBtn = wrapper.querySelector("#restart-test-btn");
let resultsChart = null;

const numTypes = 4;

// --- BLOQUES DISC (28 bloques, 4 opciones cada uno) ---
// Test DISC con metodología de elección forzada MOST/LEAST
// Cada bloque tiene 4 opciones: una D, una I, una S, una C
const discBlocks = [
  // Bloque 1
  {
    options: [
      { text: "Tomo decisiones rápidas ante presión para destrabar el avance.", dimension: "D" },
      { text: "Motivo al equipo y conecto ideas para alinear a las personas.", dimension: "I" },
      { text: "Mantengo la calma y doy soporte constante en procesos repetibles.", dimension: "S" },
      { text: "Verifico criterios y evidencias antes de aprobar un entregable.", dimension: "C" }
    ]
  },
  // Bloque 2
  {
    options: [
      { text: "Impulso cambios inmediatos cuando veo oportunidades de mejora.", dimension: "D" },
      { text: "Genero entusiasmo y construyo consenso alrededor de nuevas ideas.", dimension: "I" },
      { text: "Proporciono estabilidad y continuidad en momentos de transición.", dimension: "S" },
      { text: "Analizo sistemáticamente todos los aspectos antes de implementar.", dimension: "C" }
    ]
  },
  // Bloque 3
  {
    options: [
      { text: "Confronto directamente los problemas para resolverlos de inmediato.", dimension: "D" },
      { text: "Uso mi influencia para movilizar recursos y personas hacia objetivos.", dimension: "I" },
      { text: "Escucho pacientemente y busco soluciones que beneficien a todos.", dimension: "S" },
      { text: "Documento meticulosamente cada paso para asegurar trazabilidad.", dimension: "C" }
    ]
  },
  // Bloque 4
  {
    options: [
      { text: "Asumo responsabilidad total por los resultados del proyecto.", dimension: "D" },
      { text: "Inspiro confianza y creo conexiones que facilitan la colaboración.", dimension: "I" },
      { text: "Mantengo el equilibrio y evito conflictos innecesarios en el equipo.", dimension: "S" },
      { text: "Sigo protocolos establecidos para garantizar consistencia y calidad.", dimension: "C" }
    ]
  },
  // Bloque 5
  {
    options: [
      { text: "Desafío el status quo y busco formas más eficientes de trabajar.", dimension: "D" },
      { text: "Comunico de manera persuasiva para ganar apoyo a mis propuestas.", dimension: "I" },
      { text: "Valoro las relaciones y priorizo el bienestar del equipo.", dimension: "S" },
      { text: "Reviso exhaustivamente cada detalle para evitar errores costosos.", dimension: "C" }
    ]
  },
  // Bloque 6
  {
    options: [
      { text: "Lidero con determinación y no me detengo ante obstáculos.", dimension: "D" },
      { text: "Creo un ambiente positivo donde las ideas fluyen libremente.", dimension: "I" },
      { text: "Proporciono apoyo constante y soy confiable en momentos difíciles.", dimension: "S" },
      { text: "Mantengo estándares altos y aseguro que todo cumple con las especificaciones.", dimension: "C" }
    ]
  },
  // Bloque 7
  {
    options: [
      { text: "Actúo con urgencia cuando la situación lo requiere.", dimension: "D" },
      { text: "Conecto con las personas y genero entusiasmo por los objetivos.", dimension: "I" },
      { text: "Busco consenso y evito decisiones que puedan generar malestar.", dimension: "S" },
      { text: "Planifico cuidadosamente cada acción para minimizar riesgos.", dimension: "C" }
    ]
  },
  // Bloque 8
  {
    options: [
      { text: "Supero obstáculos con determinación y enfoque en resultados.", dimension: "D" },
      { text: "Facilito la comunicación y construyo puentes entre diferentes grupos.", dimension: "I" },
      { text: "Mantengo la armonía y busco soluciones que satisfagan a todos.", dimension: "S" },
      { text: "Implemento controles rigurosos para asegurar la calidad del trabajo.", dimension: "C" }
    ]
  },
  // Bloque 9
  {
    options: [
      { text: "Tomo el control cuando otros no pueden decidir.", dimension: "D" },
      { text: "Energizo al equipo y creo momentum hacia los objetivos.", dimension: "I" },
      { text: "Proporciono estabilidad emocional en situaciones estresantes.", dimension: "S" },
      { text: "Aseguro que todos los procesos sigan las mejores prácticas.", dimension: "C" }
    ]
  },
  // Bloque 10
  {
    options: [
      { text: "Competir y ganar me motiva más que colaborar.", dimension: "D" },
      { text: "Construir relaciones sólidas es fundamental para mi éxito.", dimension: "I" },
      { text: "Mantener la paz y evitar conflictos es mi prioridad.", dimension: "S" },
      { text: "Hacer las cosas correctamente es más importante que hacerlas rápido.", dimension: "C" }
    ]
  },
  // Bloque 11
  {
    options: [
      { text: "Prefiero dirigir proyectos que participar en equipos.", dimension: "D" },
      { text: "Me siento cómodo siendo el centro de atención en reuniones.", dimension: "I" },
      { text: "Valoro más la armonía del equipo que los resultados individuales.", dimension: "S" },
      { text: "La precisión y exactitud son más importantes que la velocidad.", dimension: "C" }
    ]
  },
  // Bloque 12
  {
    options: [
      { text: "Busco constantemente nuevas oportunidades de crecimiento.", dimension: "D" },
      { text: "Me gusta ser reconocido por mis contribuciones al equipo.", dimension: "I" },
      { text: "Prefiero un ambiente de trabajo estable y predecible.", dimension: "S" },
      { text: "Me enfoco en hacer las cosas de manera sistemática y ordenada.", dimension: "C" }
    ]
  },
  // Bloque 13
  {
    options: [
      { text: "Me siento cómodo tomando decisiones difíciles que otros evitan.", dimension: "D" },
      { text: "Disfruto presentando ideas y convenciendo a otros de su valor.", dimension: "I" },
      { text: "Prefiero escuchar y entender antes de actuar.", dimension: "S" },
      { text: "Me aseguro de que todos los detalles estén correctos antes de proceder.", dimension: "C" }
    ]
  },
  // Bloque 14
  {
    options: [
      { text: "Me motiva más superar desafíos que mantener relaciones.", dimension: "D" },
      { text: "Creo que las relaciones personales son clave para el éxito profesional.", dimension: "I" },
      { text: "Creo que la cooperación es más valiosa que la competencia.", dimension: "S" },
      { text: "Creo que seguir procedimientos establecidos evita problemas.", dimension: "C" }
    ]
  },
  // Bloque 15
  {
    options: [
      { text: "Actúo rápidamente cuando veo una oportunidad de mejora.", dimension: "D" },
      { text: "Uso mi personalidad para influir positivamente en el ambiente.", dimension: "I" },
      { text: "Mantengo la calma y busco soluciones que no generen fricción.", dimension: "S" },
      { text: "Reviso cuidadosamente cada aspecto antes de tomar decisiones.", dimension: "C" }
    ]
  },
  // Bloque 16
  {
    options: [
      { text: "Prefiero liderar iniciativas que seguir instrucciones.", dimension: "D" },
      { text: "Me gusta ser el punto de conexión entre diferentes personas.", dimension: "I" },
      { text: "Valoro la estabilidad y evito cambios innecesarios.", dimension: "S" },
      { text: "Me enfoco en la calidad y precisión de cada tarea.", dimension: "C" }
    ]
  },
  // Bloque 17
  {
    options: [
      { text: "Me siento cómodo asumiendo riesgos calculados.", dimension: "D" },
      { text: "Disfruto motivando a otros y creando entusiasmo.", dimension: "I" },
      { text: "Prefiero un enfoque gradual y cuidadoso para los cambios.", dimension: "S" },
      { text: "Me aseguro de que todo esté documentado y verificado.", dimension: "C" }
    ]
  },
  // Bloque 18
  {
    options: [
      { text: "Busco constantemente formas de optimizar y mejorar procesos.", dimension: "D" },
      { text: "Creo que la comunicación abierta es fundamental para el éxito.", dimension: "I" },
      { text: "Creo que mantener buenas relaciones es más importante que ganar.", dimension: "S" },
      { text: "Creo que la consistencia y el orden son fundamentales.", dimension: "C" }
    ]
  },
  // Bloque 19
  {
    options: [
      { text: "Me siento cómodo siendo directo y franco en mis comunicaciones.", dimension: "D" },
      { text: "Me gusta crear un ambiente donde todos se sientan valorados.", dimension: "I" },
      { text: "Prefiero buscar consenso antes de tomar decisiones importantes.", dimension: "S" },
      { text: "Me enfoco en asegurar que todo cumpla con los estándares establecidos.", dimension: "C" }
    ]
  },
  // Bloque 20
  {
    options: [
      { text: "Me motiva más lograr resultados que mantener armonía.", dimension: "D" },
      { text: "Me motiva más inspirar a otros que seguir procedimientos.", dimension: "I" },
      { text: "Me motiva más ayudar a otros que competir por reconocimiento.", dimension: "S" },
      { text: "Me motiva más hacer las cosas correctamente que hacerlas rápido.", dimension: "C" }
    ]
  },
  // Bloque 21
  {
    options: [
      { text: "Prefiero tomar decisiones rápidas que analizar exhaustivamente.", dimension: "D" },
      { text: "Prefiero trabajar en equipo que individualmente.", dimension: "I" },
      { text: "Prefiero mantener estabilidad que buscar cambios constantes.", dimension: "S" },
      { text: "Prefiero seguir procedimientos que improvisar soluciones.", dimension: "C" }
    ]
  },
  // Bloque 22
  {
    options: [
      { text: "Me siento más cómodo dirigiendo que siendo dirigido.", dimension: "D" },
      { text: "Me siento más cómodo siendo visible que trabajando en segundo plano.", dimension: "I" },
      { text: "Me siento más cómodo apoyando que liderando.", dimension: "S" },
      { text: "Me siento más cómodo verificando que creando.", dimension: "C" }
    ]
  },
  // Bloque 23
  {
    options: [
      { text: "Busco constantemente nuevas formas de superar limitaciones.", dimension: "D" },
      { text: "Busco constantemente nuevas formas de conectar con otros.", dimension: "I" },
      { text: "Busco constantemente nuevas formas de mantener la armonía.", dimension: "S" },
      { text: "Busco constantemente nuevas formas de mejorar la precisión.", dimension: "C" }
    ]
  },
  // Bloque 24
  {
    options: [
      { text: "Me siento más satisfecho cuando supero obstáculos difíciles.", dimension: "D" },
      { text: "Me siento más satisfecho cuando ayudo a otros a tener éxito.", dimension: "I" },
      { text: "Me siento más satisfecho cuando mantengo la paz en el equipo.", dimension: "S" },
      { text: "Me siento más satisfecho cuando todo está perfectamente organizado.", dimension: "C" }
    ]
  },
  // Bloque 25
  {
    options: [
      { text: "Prefiero enfrentar conflictos directamente que evitarlos.", dimension: "D" },
      { text: "Prefiero generar entusiasmo que mantener calma.", dimension: "I" },
      { text: "Prefiero buscar compromisos que imponer soluciones.", dimension: "S" },
      { text: "Prefiero analizar detalladamente que actuar intuitivamente.", dimension: "C" }
    ]
  },
  // Bloque 26
  {
    options: [
      { text: "Me siento más energizado cuando tengo desafíos que resolver.", dimension: "D" },
      { text: "Me siento más energizado cuando puedo influir positivamente en otros.", dimension: "I" },
      { text: "Me siento más energizado cuando puedo proporcionar estabilidad.", dimension: "S" },
      { text: "Me siento más energizado cuando puedo perfeccionar los detalles.", dimension: "C" }
    ]
  },
  // Bloque 27
  {
    options: [
      { text: "Creo que la competencia sana mejora el rendimiento del equipo.", dimension: "D" },
      { text: "Creo que la colaboración abierta mejora los resultados del equipo.", dimension: "I" },
      { text: "Creo que la cooperación armoniosa mejora la productividad del equipo.", dimension: "S" },
      { text: "Creo que los procesos bien definidos mejoran la eficiencia del equipo.", dimension: "C" }
    ]
  },
  // Bloque 28
  {
    options: [
      { text: "Me siento más realizado cuando logro objetivos ambiciosos.", dimension: "D" },
      { text: "Me siento más realizado cuando construyo relaciones significativas.", dimension: "I" },
      { text: "Me siento más realizado cuando proporciono apoyo constante.", dimension: "S" },
      { text: "Me siento más realizado cuando aseguro la excelencia en cada detalle.", dimension: "C" }
    ]
  }
];

const typeColors = [
  "#FF595E", // Dominancia
  "#FFCA3A", // Influencia
  "#22C55E", // Estabilidad (verde más estándar)
  "#1982C4", // Cumplimiento
];
const typeLabels = ["Dominancia", "Influencia", "Serenidad", "Cumplimiento"];
const grayColor = "#CCCCCC";

// Función para inicializar el quiz
function initializeQuiz() {
  if (!quizContainer || !quizForm || !paginationControlsDiv) {
    console.error("Elementos del quiz no encontrados");
    return;
  }

  // Validar que tenemos bloques
  if (!discBlocks || discBlocks.length === 0) {
    console.error("No hay bloques disponibles");
    showAlert("Error: No hay bloques disponibles para el test.");
    return;
  }

  // Mezclar bloques aleatoriamente
  shuffledBlocks = [...discBlocks].sort(() => Math.random() - 0.5);
  userResponses = new Array(shuffledBlocks.length).fill(null);
  currentBlockIndex = 0;
  
  console.log(`Test inicializado con ${shuffledBlocks.length} bloques`);

  // Mostrar el formulario del quiz
  startTestContainer.style.display = "none";
  quizForm.style.display = "block";
  paginationControlsDiv.style.display = "block";

  // Crear botones de paginación
  createPaginationButtons();
  
  // Renderizar primer bloque
  renderCurrentBlock();
  updatePaginationButtons();
}

// Función para crear botones de paginación
function createPaginationButtons() {
  if (!paginationControlsDiv) return;

  // Limpiar contenido existente
  paginationControlsDiv.innerHTML = '';

  // Crear contenedor para botones
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'space-between';
  buttonsContainer.style.alignItems = 'center';
  buttonsContainer.style.gap = '10px';

  // Botón Anterior
  const prevBtn = document.createElement('button');
  prevBtn.id = 'prev-btn';
  prevBtn.textContent = '← Anterior';
  prevBtn.style.display = 'inline-block';
  prevBtn.style.padding = '10px 20px';
  prevBtn.style.fontSize = '1em';
  prevBtn.style.fontWeight = 'bold';
  prevBtn.style.backgroundColor = '#3f51b5';
  prevBtn.style.color = 'white';
  prevBtn.style.border = 'none';
  prevBtn.style.borderRadius = '5px';
  prevBtn.style.cursor = 'pointer';
  prevBtn.style.transition = 'background-color 0.3s ease';

  // Botón Siguiente
  const nextBtn = document.createElement('button');
  nextBtn.id = 'next-btn';
  nextBtn.textContent = 'Siguiente →';
  nextBtn.style.display = 'inline-block';
  nextBtn.style.padding = '10px 20px';
  nextBtn.style.fontSize = '1em';
  nextBtn.style.fontWeight = 'bold';
  nextBtn.style.backgroundColor = '#3f51b5';
  nextBtn.style.color = 'white';
  nextBtn.style.border = 'none';
  nextBtn.style.borderRadius = '5px';
  nextBtn.style.cursor = 'pointer';
  nextBtn.style.transition = 'background-color 0.3s ease';

  // Event listeners para los botones
  prevBtn.addEventListener("click", () => {
    if (currentBlockIndex > 0) {
      currentBlockIndex--;
      renderCurrentBlock();
      updatePaginationButtons();
      
      // Scroll suave hacia la parte superior de la página
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  });

  nextBtn.addEventListener("click", async () => {
    if (!isCurrentBlockCompleted()) {
      showAlert(
        "Por favor, selecciona una opción MÁS y una opción MENOS antes de continuar."
      );
      return;
    }

    if (currentBlockIndex < shuffledBlocks.length - 1) {
      currentBlockIndex++;
      renderCurrentBlock();
      updatePaginationButtons();
      
      // Scroll suave hacia la parte superior de la página
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 50);
    }
  });

  // Añadir botones al contenedor
  buttonsContainer.appendChild(prevBtn);
  buttonsContainer.appendChild(nextBtn);
  paginationControlsDiv.appendChild(buttonsContainer);
}

function renderCurrentBlock() {
  if (!quizContainer) return;
  
  const currentBlock = shuffledBlocks[currentBlockIndex];
  if (!currentBlock) return;

  quizContainer.innerHTML = `
    <div class="pagination-indicator" style="margin-bottom:10px; font-weight:bold;">
      Bloque ${currentBlockIndex + 1}/${shuffledBlocks.length}
    </div>
    <div class="block-instructions" style="margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px; border-left:4px solid #1982C4;">
      <strong>📋 Instrucciones:</strong> De las 4 opciones siguientes, selecciona <strong>👍 1 que MÁS te describe</strong> y <strong>👎 1 que MENOS te describe</strong>. No puedes seleccionar la misma opción para ambas.
    </div>
  `;

  const blockDiv = document.createElement("div");
  blockDiv.className = "disc-block ui-card";
  blockDiv.id = `block-${currentBlockIndex}`;
  blockDiv.style.marginBottom = "10px";

  // Crear opciones del bloque
  currentBlock.options.forEach((option, optionIndex) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "block-option";
    optionDiv.style.cssText = `
      margin: 10px 0;
      padding: 15px;
      border: 2px solid #e1e5e9;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    `;

    const optionText = document.createElement("div");
    optionText.textContent = option.text;
    optionText.style.cssText = `
      font-size: 1rem;
      line-height: 1.4;
      color: #2d3748;
    `;

    const selectionControls = document.createElement("div");
    selectionControls.style.cssText = `
      display: flex;
      gap: 15px;
      margin-top: 10px;
      justify-content: center;
    `;

    const mostButton = document.createElement("button");
    mostButton.innerHTML = "👍 MÁS me describe";
    mostButton.className = "selection-btn most-btn";
    mostButton.style.cssText = `
      padding: 10px 18px;
      border: 2px solid #22C55E;
      background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
      color: #16a34a;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95em;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(34, 197, 94, 0.1);
    `;

    const leastButton = document.createElement("button");
    leastButton.innerHTML = "👎 MENOS me describe";
    leastButton.className = "selection-btn least-btn";
    leastButton.style.cssText = `
      padding: 10px 18px;
      border: 2px solid #ef4444;
      background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
      color: #dc2626;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95em;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);
    `;

    // Efectos hover para los botones
    mostButton.addEventListener('mouseenter', () => {
      mostButton.style.transform = 'translateY(-2px)';
      mostButton.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.2)';
      mostButton.style.background = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
      mostButton.style.color = '#16a34a';
    });
    
    mostButton.addEventListener('mouseleave', () => {
      mostButton.style.transform = 'translateY(0)';
      mostButton.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.1)';
      mostButton.style.background = 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)';
      mostButton.style.color = '#16a34a';
    });

    leastButton.addEventListener('mouseenter', () => {
      leastButton.style.transform = 'translateY(-2px)';
      leastButton.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.2)';
      leastButton.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
      leastButton.style.color = '#dc2626';
    });
    
    leastButton.addEventListener('mouseleave', () => {
      leastButton.style.transform = 'translateY(0)';
      leastButton.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.1)';
      leastButton.style.background = 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)';
      leastButton.style.color = '#dc2626';
    });

    // Efectos de clic para feedback visual inmediato
    mostButton.addEventListener('mousedown', () => {
      mostButton.style.setProperty('background-color', '#15803d', 'important'); // Verde más oscuro
      mostButton.style.setProperty('color', 'white', 'important');
      mostButton.style.transform = 'scale(0.98)';
    });
    
    mostButton.addEventListener('mouseup', () => {
      // Restaurar al estado correcto según si está seleccionado o no
      const currentResponse = userResponses[currentBlockIndex];
      if (currentResponse && currentResponse.most === optionIndex) {
        mostButton.style.setProperty('background-color', 'transparent', 'important');
        mostButton.style.setProperty('color', '#3f51b5', 'important');
      } else {
        mostButton.style.setProperty('background-color', 'transparent', 'important');
        mostButton.style.setProperty('color', '#16a34a', 'important');
      }
      mostButton.style.transform = 'scale(1)';
    });
    
    mostButton.addEventListener('mouseleave', () => {
      // Restaurar al estado correcto según si está seleccionado o no
      const currentResponse = userResponses[currentBlockIndex];
      if (currentResponse && currentResponse.most === optionIndex) {
        mostButton.style.setProperty('background-color', 'transparent', 'important');
        mostButton.style.setProperty('color', '#3f51b5', 'important');
      } else {
        mostButton.style.setProperty('background-color', 'transparent', 'important');
        mostButton.style.setProperty('color', '#16a34a', 'important');
      }
      mostButton.style.transform = 'scale(1)';
    });

    leastButton.addEventListener('mousedown', () => {
      leastButton.style.setProperty('background-color', '#b91c1c', 'important'); // Rojo más oscuro
      leastButton.style.setProperty('color', 'white', 'important');
      leastButton.style.transform = 'scale(0.98)';
    });
    
    leastButton.addEventListener('mouseup', () => {
      // Restaurar al estado correcto según si está seleccionado o no
      const currentResponse = userResponses[currentBlockIndex];
      if (currentResponse && currentResponse.least === optionIndex) {
        leastButton.style.setProperty('background-color', 'transparent', 'important');
        leastButton.style.setProperty('color', '#3f51b5', 'important');
      } else {
        leastButton.style.setProperty('background-color', 'transparent', 'important');
        leastButton.style.setProperty('color', '#dc2626', 'important');
      }
      leastButton.style.transform = 'scale(1)';
    });
    
    leastButton.addEventListener('mouseleave', () => {
      // Restaurar al estado correcto según si está seleccionado o no
      const currentResponse = userResponses[currentBlockIndex];
      if (currentResponse && currentResponse.least === optionIndex) {
        leastButton.style.setProperty('background-color', 'transparent', 'important');
        leastButton.style.setProperty('color', '#3f51b5', 'important');
      } else {
        leastButton.style.setProperty('background-color', 'transparent', 'important');
        leastButton.style.setProperty('color', '#dc2626', 'important');
      }
      leastButton.style.transform = 'scale(1)';
    });

    // Event listeners para los botones
    mostButton.addEventListener('click', () => {
      selectOption(currentBlockIndex, optionIndex, 'most', option.dimension);
    });

    leastButton.addEventListener('click', () => {
      selectOption(currentBlockIndex, optionIndex, 'least', option.dimension);
    });

    selectionControls.appendChild(mostButton);
    selectionControls.appendChild(leastButton);
    optionDiv.appendChild(optionText);
    optionDiv.appendChild(selectionControls);
    blockDiv.appendChild(optionDiv);
  });

  quizContainer.appendChild(blockDiv);
}

// Función para verificar si el bloque actual está completado
function isCurrentBlockCompleted() {
  const currentResponse = userResponses[currentBlockIndex];
  return currentResponse && 
         currentResponse.most !== null && 
         currentResponse.least !== null;
}

// Función para manejar la selección de opciones MOST/LEAST
function selectOption(blockIndex, optionIndex, selectionType, dimension) {
  if (!userResponses[blockIndex]) {
    userResponses[blockIndex] = { most: null, least: null };
  }

  // Verificar si ya se seleccionó la misma opción para el otro tipo
  const currentResponse = userResponses[blockIndex];
  if (selectionType === 'most' && currentResponse.least === optionIndex) {
    showAlert('No puedes seleccionar la misma opción para MÁS y MENOS');
    return;
  }
  if (selectionType === 'least' && currentResponse.most === optionIndex) {
    showAlert('No puedes seleccionar la misma opción para MÁS y MENOS');
    return;
  }

  // Actualizar la selección
  userResponses[blockIndex][selectionType] = optionIndex;
  userResponses[blockIndex][`${selectionType}Dimension`] = dimension;

  // Actualizar la interfaz visual
  updateBlockVisuals(blockIndex);
  
  // Verificar si el bloque está completo
  if (userResponses[blockIndex].most !== null && userResponses[blockIndex].least !== null) {
    console.log(`Bloque ${blockIndex + 1} completado:`, userResponses[blockIndex]);
  }
}

// Función para actualizar los estilos visuales del bloque
function updateBlockVisuals(blockIndex) {
  const blockDiv = document.getElementById(`block-${blockIndex}`);
  if (!blockDiv) return;

  const currentResponse = userResponses[blockIndex];
  const options = blockDiv.querySelectorAll('.block-option');

  options.forEach((optionDiv, optionIndex) => {
    const mostBtn = optionDiv.querySelector('.most-btn');
    const leastBtn = optionDiv.querySelector('.least-btn');

    // Resetear estilos
    optionDiv.style.borderColor = '#e1e5e9';
    optionDiv.style.backgroundColor = 'white';
    mostBtn.style.setProperty('background-color', 'transparent', 'important');
    mostBtn.style.setProperty('color', '#16a34a', 'important');
    mostBtn.style.setProperty('border-color', '#22C55E', 'important');
    mostBtn.style.setProperty('box-shadow', '0 2px 4px rgba(34, 197, 94, 0.1)', 'important');
    leastBtn.style.setProperty('background-color', 'transparent', 'important');
    leastBtn.style.setProperty('color', '#dc2626', 'important');
    leastBtn.style.setProperty('border-color', '#ef4444', 'important');
    leastBtn.style.setProperty('box-shadow', '0 2px 4px rgba(239, 68, 68, 0.1)', 'important');

    // Aplicar estilos según selección
    if (currentResponse.most === optionIndex) {
      optionDiv.style.borderColor = '#3f51b5';
      optionDiv.style.backgroundColor = '#f3f4f6';
      mostBtn.style.setProperty('background-color', 'transparent', 'important');
      mostBtn.style.setProperty('color', '#3f51b5', 'important');
      mostBtn.style.setProperty('border-color', '#3f51b5', 'important');
      mostBtn.style.setProperty('box-shadow', '0 4px 8px rgba(63, 81, 181, 0.3)', 'important');
    }
    if (currentResponse.least === optionIndex) {
      optionDiv.style.borderColor = '#3f51b5';
      optionDiv.style.backgroundColor = '#f3f4f6';
      leastBtn.style.setProperty('background-color', 'transparent', 'important');
      leastBtn.style.setProperty('color', '#3f51b5', 'important');
      leastBtn.style.setProperty('border-color', '#3f51b5', 'important');
      leastBtn.style.setProperty('box-shadow', '0 4px 8px rgba(63, 81, 181, 0.3)', 'important');
    }
  });
}

function updatePaginationButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (!prevBtn || !nextBtn || !submitBtn) return;

  const totalBlocks = shuffledBlocks.length;
  prevBtn.disabled = currentBlockIndex === 0;

  // Mostrar u ocultar el botón "Siguiente"
  if (currentBlockIndex === totalBlocks - 1) {
    nextBtn.style.display = "none";
    submitBtn.style.display = "block";
    // Alinear los botones en la última página
    const pagBtnsWrapper = paginationControlsDiv.querySelector("div");
    if (pagBtnsWrapper && !pagBtnsWrapper.querySelector("#submit-btn")) {
      pagBtnsWrapper.innerHTML = "";
      pagBtnsWrapper.appendChild(prevBtn);
      pagBtnsWrapper.appendChild(submitBtn);
      prevBtn.style.display = "inline-block";
      submitBtn.style.display = "inline-block";
    }
  } else {
    // Restaurar los botones normales
    const pagBtnsWrapper = paginationControlsDiv.querySelector("div");
    if (pagBtnsWrapper) {
      pagBtnsWrapper.innerHTML = "";
      pagBtnsWrapper.appendChild(prevBtn);
      pagBtnsWrapper.appendChild(nextBtn);
      prevBtn.style.display = "inline-block";
      nextBtn.style.display = "inline-block";
    }
    submitBtn.style.display = "none";
  }
}

function areCurrentPageQuestionsAnswered() {
  const startIdx = (currentPage - 1) * questionsPerPage;
  const endIdx = Math.min(
    startIdx + questionsPerPage,
    shuffledQuestions.length
  );

  for (let i = startIdx; i < endIdx; i++) {
    if (userResponses[i] === null) {
      const questionDiv = document.querySelector(`#question-global-${i}`);
      if (questionDiv) {
        questionDiv.style.borderColor = "red";
        questionDiv.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
  }
  return true;
}

function areAllQuestionsAnswered() {
  for (let i = 0; i < userResponses.length; i++) {
    if (userResponses[i] === null) {
      return false;
    }
  }
  return true;
}

function updateSubmitButtonVisibility() {
  if (!submitBtn) return;

  const allAnswered = areAllQuestionsAnswered();
  if (
    allAnswered &&
    currentPage === Math.ceil(shuffledQuestions.length / questionsPerPage)
  ) {
    submitBtn.style.display = "block";
  }
}

function calculateScores() {
  if (userResponses.length !== shuffledBlocks.length) {
    console.error(
      `Longitud de respuestas (${userResponses.length}) no coincide con bloques (${shuffledBlocks.length})`
    );
    showAlert("Error al procesar respuestas. Intenta recargar la página.");
    return null;
  }
  
  if (!areAllBlocksCompleted()) {
    // Encontrar el primer bloque sin completar
    for (let i = 0; i < userResponses.length; i++) {
      if (!userResponses[i] || userResponses[i].most === null || userResponses[i].least === null) {
        currentBlockIndex = i;
        renderCurrentBlock();
        updatePaginationButtons();
        setTimeout(() => {
          const missingBlockDiv = document.querySelector(`#block-${i}`);
          if (missingBlockDiv) {
            missingBlockDiv.style.borderColor = "red";
            missingBlockDiv.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
          showAlert("Aún faltan bloques por completar. Por favor, completa todos.");
        }, 100);
        return null;
      }
    }
  }
  
  hideAlert();

  // Sistema de puntuación ipsativo MOST/LEAST
  const rawScores = { D: 0, I: 0, S: 0, C: 0 };
  
  userResponses.forEach((response, blockIndex) => {
    if (response && response.most !== null && response.least !== null) {
      // +1 para la dimensión seleccionada como MOST
      const mostDimension = response.mostDimension;
      rawScores[mostDimension]++;
      
      // -1 para la dimensión seleccionada como LEAST
      const leastDimension = response.leastDimension;
      rawScores[leastDimension]--;
    }
  });

  // Convertir scores ipsativos a porcentajes sobre 100 (sin negativos)
  // Rango típico: [-28, +28] -> [0, 100]
  const normalizedScores = {
    D: Math.max(0, Math.min(100, ((rawScores.D + 28) / 56) * 100)),
    I: Math.max(0, Math.min(100, ((rawScores.I + 28) / 56) * 100)),
    S: Math.max(0, Math.min(100, ((rawScores.S + 28) / 56) * 100)),
    C: Math.max(0, Math.min(100, ((rawScores.C + 28) / 56) * 100))
  };

  // Convertir a array en orden D, I, S, C
  const scores = [normalizedScores.D, normalizedScores.I, normalizedScores.S, normalizedScores.C];
  
  console.log("Raw scores (ipsativo):", rawScores);
  console.log("Scores normalizados (0-100):", normalizedScores);
  console.log("Scores finales:", scores);
  return scores;
}

// Función para verificar si todos los bloques están completados
function areAllBlocksCompleted() {
  return userResponses.every(response => 
    response && 
    response.most !== null && 
    response.least !== null
  );
}

function displayResults(scores) {
  if (
    !resultsTextDiv ||
    !resultsContainer ||
    !paginationControlsDiv ||
    !submitBtn ||
    !quizForm
  )
    return;

  // Ocultar el formulario del quiz y mostrar resultados
  quizForm.style.display = "none";
  paginationControlsDiv.style.display = "none";
  submitBtn.style.display = "none";
  
  // Mostrar el contenedor de resultados
  resultsContainer.style.display = "block";
  
  console.log("Mostrando resultados:", {
    resultsContainer: resultsContainer,
    resultsTextDiv: resultsTextDiv,
    scores: scores
  });
  
  // Calcular el tipo dominante
  const maxScore = Math.max(...scores);
  const dominantTypeIndex = scores.indexOf(maxScore);
  const dominantTypeName = typeLabels[dominantTypeIndex];
  
  // Definir descripciones detalladas para cada tipo
  const typeDescriptions = {
    'Dominancia': {
      title: 'Dominancia',
      description: 'Eres una persona orientada a resultados, directa y decidida. Te caracterizas por tu capacidad de liderazgo natural, tu enfoque en objetivos claros y tu habilidad para tomar decisiones rápidas bajo presión.',
      strengths: ['Liderazgo natural', 'Orientación a resultados', 'Toma de decisiones', 'Superación de obstáculos'],
      workStyle: 'Prefieres entornos dinámicos donde puedas ejercer control y autoridad. Te motiva superar desafíos y alcanzar metas ambiciosas.'
    },
    'Influencia': {
      title: 'Influencia',
      description: 'Eres una persona sociable, persuasiva y optimista. Te caracterizas por tu capacidad de motivar a otros, tu facilidad para comunicar ideas y tu enfoque en las relaciones interpersonales.',
      strengths: ['Comunicación efectiva', 'Motivación de equipos', 'Construcción de relaciones', 'Pensamiento positivo'],
      workStyle: 'Prefieres entornos colaborativos donde puedas interactuar con personas y trabajar en equipo. Te motiva el reconocimiento y la conexión con otros.'
    },
    'Serenidad': {
      title: 'Serenidad',
      description: 'Eres una persona paciente, confiable y cooperativa. Te caracterizas por tu capacidad de mantener la calma, tu enfoque en la estabilidad y tu habilidad para apoyar a otros de manera constante.',
      strengths: ['Paciencia y tolerancia', 'Apoyo constante', 'Mantenimiento de armonía', 'Confiabilidad'],
      workStyle: 'Prefieres entornos estables y predecibles donde puedas contribuir de manera consistente. Te motiva la seguridad y el bienestar del equipo.'
    },
    'Cumplimiento': {
      title: 'Cumplimiento',
      description: 'Eres una persona analítica, meticulosa y orientada a la calidad. Te caracterizas por tu capacidad de atención al detalle, tu enfoque en la precisión y tu habilidad para seguir procedimientos establecidos.',
      strengths: ['Análisis detallado', 'Precisión y exactitud', 'Seguimiento de procedimientos', 'Control de calidad'],
      workStyle: 'Prefieres entornos estructurados donde puedas aplicar metodologías probadas. Te motiva la excelencia y la mejora continua.'
    }
  };

  // Definir características laborales
  const workCharacteristics = {
    'Dominancia': [
      'Liderazgo natural y toma de decisiones',
      'Orientación a resultados y objetivos',
      'Capacidad de superar obstáculos',
      'Iniciativa y proactividad'
    ],
    'Influencia': [
      'Comunicación efectiva y persuasiva',
      'Motivación y entusiasmo',
      'Construcción de relaciones',
      'Pensamiento positivo y optimista'
    ],
    'Serenidad': [
      'Paciencia y tolerancia',
      'Apoyo constante al equipo',
      'Mantenimiento de armonía',
      'Confiabilidad y estabilidad'
    ],
    'Cumplimiento': [
      'Análisis detallado y preciso',
      'Seguimiento de procedimientos',
      'Control de calidad',
      'Precisión y exactitud'
    ]
  };
  
  // Obtener información del tipo dominante
  const dominantInfo = typeDescriptions[dominantTypeName];
  
  // Calcular dimensiones altas (mayores a 60)
  const highDimensions = [];
  scores.forEach((score, index) => {
    if (score > 60) {
      highDimensions.push(typeLabels[index].charAt(0));
    }
  });

  // Definir características clave basadas en el perfil
  const keyCharacteristics = {
    'Dominancia': [
      'Aporta un enfoque directo y orientado a resultados.',
      'Brinda liderazgo natural y toma de decisiones rápida.',
      'Promueve la superación de obstáculos y desafíos.',
      'Realiza acciones inmediatas para alcanzar objetivos.',
      'Valora el control y la autoridad en el trabajo.'
    ],
    'Influencia': [
      'Aporta un enfoque sociable y motivador.',
      'Brinda comunicación efectiva y persuasiva.',
      'Promueve la construcción de relaciones positivas.',
      'Realiza actividades de networking y colaboración.',
      'Valora el reconocimiento y la conexión interpersonal.'
    ],
    'Serenidad': [
      'Aporta un enfoque paciente y cooperativo.',
      'Brinda estabilidad y apoyo constante al equipo.',
      'Promueve la armonía y el trabajo en equipo.',
      'Realiza tareas de manera consistente y confiable.',
      'Valora un ambiente estable y predecible.'
    ],
    'Cumplimiento': [
      'Aporta un enfoque metódico y detallista.',
      'Brinda un alto nivel de precisión y calidad.',
      'Promueve el cumplimiento de normas y procesos.',
      'Realiza análisis exhaustivos antes de actuar.',
      'Valora un ambiente estable y bien definido.'
    ]
  };

  // Definir sliders de comportamiento
  const behaviorSliders = {
    'Dominancia': [
      { left: 'Más idealista', right: 'Más pragmático', position: 25 },
      { left: 'Enfoque en detalles', right: 'Visión global', position: 75 },
      { left: 'Orientado a resultados rápidos', right: 'Más orientado a procesos', position: 20 },
      { left: 'Más proactivo', right: 'Más reactivo', position: 15 },
      { left: 'Más innovación', right: 'Más rutina', position: 30 },
      { left: 'Más tolerante a la ambigüedad', right: 'Más necesidad de claridad', position: 35 },
      { left: 'Más analítico', right: 'Más intuitivo', position: 40 },
      { left: 'Más tolerante al riesgo', right: 'Más adverso al riesgo', position: 25 },
      { left: 'Enfoque en el equipo', right: 'Enfoque en tareas', position: 80 }
    ],
    'Influencia': [
      { left: 'Más idealista', right: 'Más pragmático', position: 30 },
      { left: 'Enfoque en detalles', right: 'Visión global', position: 85 },
      { left: 'Orientado a resultados rápidos', right: 'Más orientado a procesos', position: 15 },
      { left: 'Más proactivo', right: 'Más reactivo', position: 20 },
      { left: 'Más innovación', right: 'Más rutina', position: 25 },
      { left: 'Más tolerante a la ambigüedad', right: 'Más necesidad de claridad', position: 40 },
      { left: 'Más analítico', right: 'Más intuitivo', position: 30 },
      { left: 'Más tolerante al riesgo', right: 'Más adverso al riesgo', position: 35 },
      { left: 'Enfoque en el equipo', right: 'Enfoque en tareas', position: 20 }
    ],
    'Serenidad': [
      { left: 'Más idealista', right: 'Más pragmático', position: 60 },
      { left: 'Enfoque en detalles', right: 'Visión global', position: 45 },
      { left: 'Orientado a resultados rápidos', right: 'Más orientado a procesos', position: 70 },
      { left: 'Más proactivo', right: 'Más reactivo', position: 60 },
      { left: 'Más innovación', right: 'Más rutina', position: 75 },
      { left: 'Más tolerante a la ambigüedad', right: 'Más necesidad de claridad', position: 55 },
      { left: 'Más analítico', right: 'Más intuitivo', position: 50 },
      { left: 'Más tolerante al riesgo', right: 'Más adverso al riesgo', position: 65 },
      { left: 'Enfoque en el equipo', right: 'Enfoque en tareas', position: 30 }
    ],
    'Cumplimiento': [
      { left: 'Más idealista', right: 'Más pragmático', position: 80 },
      { left: 'Enfoque en detalles', right: 'Visión global', position: 15 },
      { left: 'Orientado a resultados rápidos', right: 'Más orientado a procesos', position: 85 },
      { left: 'Más proactivo', right: 'Más reactivo', position: 70 },
      { left: 'Más innovación', right: 'Más rutina', position: 90 },
      { left: 'Más tolerante a la ambigüedad', right: 'Más necesidad de claridad', position: 85 },
      { left: 'Más analítico', right: 'Más intuitivo', position: 90 },
      { left: 'Más tolerante al riesgo', right: 'Más adverso al riesgo', position: 85 },
      { left: 'Enfoque en el equipo', right: 'Enfoque en tareas', position: 80 }
    ]
  };

  // Crear HTML estilo MiPerfilDISC
  const simpleHTML = `
    <div style="max-width: 1000px; margin: 0 auto; padding: 20px; background: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, ${typeColors[dominantTypeIndex]}, ${typeColors[dominantTypeIndex]}dd); color: white; padding: 15px 30px; border-radius: 12px; display: inline-block; font-weight: 800; font-size: 1.2em; letter-spacing: 1px; text-shadow: 0 2px 6px rgba(0,0,0,0.28), 0 1px 2px rgba(0,0,0,0.24);">
          ${dominantInfo.title.toUpperCase()} | ${dominantInfo.strengths.slice(0, 2).join(' | ').toUpperCase()}
        </div>
      </div>

      <!-- Contenido principal en dos columnas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
        
        <!-- Columna izquierda: Gráfico -->
        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 1.3em; text-align: center;">Nivel de intensidad</h3>
          
          <!-- Gráfico simplificado -->
          <div style="height: 300px; background: #f8fafc; border-radius: 8px; padding: 20px; display: flex; align-items: end; justify-content: space-around; position: relative;">
            ${scores.map((score, index) => `
              <div style="display: flex; flex-direction: column; align-items: center; flex: 1; position: relative;">
                <!-- Barra -->
                <div style="width: 50px; height: ${Math.min((score / 100) * 200, 200)}px; background: linear-gradient(to top, ${typeColors[index]}, ${typeColors[index]}dd); border-radius: 6px 6px 0 0; margin-bottom: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.15); transition: transform 0.2s ease; max-height: 200px;"></div>
                <!-- Etiqueta de la dimensión -->
                <div style="font-weight: 800; color: ${typeColors[index]}; font-size: 1.4em; margin-bottom: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">${typeLabels[index].charAt(0)}</div>
                <!-- Puntaje -->
                <div style="font-size: 1em; color: #374151; font-weight: 700; background: white; padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${Math.round(score)}</div>
              </div>
            `).join('')}
          </div>
          
          <!-- Dimensiones altas -->
          <div style="text-align: center; margin-top: 20px; font-weight: 600; color: #1f2937; font-size: 1.1em;">
            Dimensiones altas: ${highDimensions.join('')}
          </div>
        </div>

        <!-- Columna derecha: Características clave -->
        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #1f2937; margin-bottom: 20px; font-size: 1.3em;">Características clave</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${keyCharacteristics[dominantTypeName].map(char => `
              <li style="margin-bottom: 12px; padding-left: 20px; position: relative; color: #374151; line-height: 1.5;">
                <span style="position: absolute; left: 0; top: 6px; width: 6px; height: 6px; background: ${typeColors[dominantTypeIndex]}; border-radius: 50%;"></span>
                ${char}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>

      <!-- Sliders de comportamiento -->
      <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <h3 style="color: #1f2937; margin-bottom: 25px; font-size: 1.3em; text-align: center;">Perfil de comportamiento</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
          ${behaviorSliders[dominantTypeName].map(slider => `
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9em; color: #6b7280;">
                <span>${slider.left}</span>
                <span>${slider.right}</span>
              </div>
              <div style="position: relative; height: 6px; background: #e5e7eb; border-radius: 3px;">
                <div style="position: absolute; left: ${slider.position}%; top: -3px; width: 12px; height: 12px; background: #000; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: translateX(-50%);"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Nota de transparencia -->
      <div style="padding: 20px; background: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 8px; font-size: 0.9em; color: #6c757d; margin-top: 25px;">
        <strong>⚠️ Nota de transparencia:</strong> Esta evaluación es orientativa y no reemplaza instrumentos clínicos ni procesos de selección especializados; es una herramienta orientativa sin pretensión diagnóstica.
      </div>
    </div>
  `;
  
  resultsTextDiv.innerHTML = simpleHTML;
  
  console.log("HTML asignado:", {
    resultsTextDiv: resultsTextDiv,
    innerHTML: resultsTextDiv.innerHTML.substring(0, 200) + "..."
  });
  
  // Scroll suave hacia los resultados
  setTimeout(() => {
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function updatePaginationButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (!prevBtn || !nextBtn || !submitBtn) return;

  const totalBlocks = shuffledBlocks.length;
  prevBtn.disabled = currentBlockIndex === 0;

  // Mostrar u ocultar el botón "Siguiente" y "Ver resultados"
  if (currentBlockIndex === totalBlocks - 1) {
    // Última pregunta: ocultar "Siguiente" y mostrar "Ver resultados"
    nextBtn.style.display = "none";
    submitBtn.style.display = "block";
    
    // Alinear los botones en la última página
    const pagBtnsWrapper = paginationControlsDiv.querySelector("div");
    if (pagBtnsWrapper && !pagBtnsWrapper.querySelector("#submit-btn")) {
      pagBtnsWrapper.innerHTML = "";
      pagBtnsWrapper.appendChild(prevBtn);
      pagBtnsWrapper.appendChild(submitBtn);
      prevBtn.style.display = "inline-block";
      submitBtn.style.display = "inline-block";
    }
  } else {
    // No es la última pregunta: mostrar "Siguiente" y ocultar "Ver resultados"
    nextBtn.style.display = "inline-block";
    submitBtn.style.display = "none";
  }
}

// Función para mostrar alertas
function showAlert(message) {
  if (!alertMessageDiv) return;
  alertMessageDiv.textContent = message;
  alertMessageDiv.style.display = "block";
  alertMessageDiv.style.background = "#ffeaea";
  alertMessageDiv.style.color = "#e74c3c";
  alertMessageDiv.style.border = "1px solid #e74c3c";
  alertMessageDiv.style.padding = "10px";
  alertMessageDiv.style.borderRadius = "6px";
  alertMessageDiv.style.margin = "10px auto";
  alertMessageDiv.style.maxWidth = "350px";
  alertMessageDiv.style.textAlign = "center";
  alertMessageDiv.style.fontWeight = "500";
}

function hideAlert() {
  if (!alertMessageDiv) return;
  alertMessageDiv.style.display = "none";
}

function showAlert(message) {
  if (!alertMessageDiv) return;
  alertMessageDiv.textContent = message;
  alertMessageDiv.style.display = "block";
  alertMessageDiv.style.background = "#ffeaea";
  alertMessageDiv.style.color = "#e74c3c";
  alertMessageDiv.style.border = "1px solid #e74c3c";
  alertMessageDiv.style.padding = "10px";
  alertMessageDiv.style.borderRadius = "6px";
  alertMessageDiv.style.margin = "10px auto";
  alertMessageDiv.style.maxWidth = "350px";
  alertMessageDiv.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideAlert() {
  if (!alertMessageDiv) return;
  alertMessageDiv.style.display = "none";
}

// Función para mostrar loader de resultados
function showResultsLoader() {
  const loader = document.createElement('div');
  loader.className = 'results-fullscreen-loader';
  loader.id = 'results-loader';
  loader.innerHTML = `
    <div class="results-loader-content">
      <div class="results-loader-spinner"></div>
      <h3 class="results-loader-title">Procesando tus resultados...</h3>
      <p class="results-loader-subtitle">Analizando tus respuestas y calculando tu perfil DISC</p>
      <div class="results-loader-dots">
        <div class="results-loader-dot"></div>
        <div class="results-loader-dot"></div>
        <div class="results-loader-dot"></div>
      </div>
    </div>
  `;
  document.body.appendChild(loader);
}

// Función para ocultar loader de resultados
function hideResultsLoader() {
  const loader = document.getElementById('results-loader');
  if (loader) {
    loader.remove();
  }
}

if (restartTestBtn) {
  restartTestBtn.addEventListener("click", () => {
    if (resultsContainer) resultsContainer.style.display = "none";
    if (startTestContainer) startTestContainer.style.display = "block";

    if (typeDescriptions && typeDescriptions.length > 0) {
      typeDescriptions.forEach((desc) => (desc.style.display = "none"));
    }

    currentBlockIndex = 0;
    shuffledBlocks = [];
    userResponses = [];
    if (resultsChart) {
      resultsChart.destroy();
      resultsChart = null;
    }
  });
} else {
  console.warn("Botón #restart-test-btn no encontrado.");
}

// Evento para iniciar test - ahora sin validación de email
if (startTestBtn) {
  startTestBtn.addEventListener("click", async function () {
    // Ejecutar diagnóstico
    diagnosticarFirebase();
    
    // Inicializar el quiz directamente sin crear documento en Firestore
    initializeQuiz();
    
    // Scroll suave hacia la parte superior de la página
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
} else {
  console.warn(
    "Botón 'start-test-btn' no encontrado. El test no se iniciará automáticamente."
  );
}

// Función para forzar el guardado de respuestas (para depuración)
async function forzarGuardadoRespuestas() {
  console.log("=== FORZANDO GUARDADO DE RESPUESTAS ===");
  console.log("Respuestas actuales:", userResponses);
  console.log("Firebase disponible:", firebaseAvailable);
  console.log("Referencia del documento:", firestoreDocRef);
  
  if (!firebaseAvailable) {
    console.log("Firebase no disponible, no se puede guardar");
    return;
  }
  
  if (!firestoreDocRef) {
    console.log("No hay referencia de documento, creando una nueva...");
    const emailInput = document.getElementById("user-email");
    const email = emailInput ? emailInput.value : "test@ejemplo.com";
    try {
      await crearDocumentoFirestore(email);
      console.log("Documento creado:", firestoreDocRef);
    } catch (error) {
      console.error("Error creando documento:", error);
      return;
    }
  }
  
  await actualizarRespuestasFirestore();
  console.log("=== FIN FORZAR GUARDADO ===");
}

// Función para forzar la creación del documento principal
async function forzarCreacionDocumento() {
  console.log("=== FORZANDO CREACIÓN DE DOCUMENTO ===");
  const emailInput = document.getElementById("user-email");
  const email = emailInput ? emailInput.value : "test@ejemplo.com";
  
  try {
    await crearDocumentoFirestore(email);
    console.log("✓ Documento creado exitosamente:", firestoreDocRef.id);
    return true;
  } catch (error) {
    console.error("Error creando documento:", error);
    return false;
  }
}

// Función para mostrar el loader de WhatsApp
function showWhatsAppLoader() {
  const loader = document.createElement('div');
  loader.className = 'whatsapp-fullscreen-loader';
  loader.id = 'whatsapp-loader';
  loader.innerHTML = `
    <div class="whatsapp-loader-content">
      <div class="whatsapp-loader-spinner"></div>
      <h3 class="whatsapp-loader-title">Procesando tu solicitud...</h3>
      <p class="whatsapp-loader-subtitle">Guardando tu número de WhatsApp y preparando el contacto</p>
      <div class="whatsapp-loader-dots">
        <div class="whatsapp-loader-dot"></div>
        <div class="whatsapp-loader-dot"></div>
        <div class="whatsapp-loader-dot"></div>
      </div>
    </div>
  `;
  document.body.appendChild(loader);
}

// Función para ocultar el loader de WhatsApp
function hideWhatsAppLoader() {
  const loader = document.getElementById('whatsapp-loader');
  if (loader) {
    loader.remove();
  }
}

// Función para cargar el script de Bitrix24
function loadBitrix24Form() {
  return new Promise((resolve, reject) => {
    console.log('🔵 [BITRIX24 LOAD] Iniciando carga del formulario');
    
    // Verificar si ya existe el script
    const existingScript = document.querySelector('script[data-b24-form="inline/348/em3lym"]');
    if (existingScript) {
      console.log('✅ [BITRIX24 LOAD] Script de Bitrix24 ya estaba cargado');
      console.log('   - Src del script:', existingScript.src);
      resolve();
      return;
    }

    console.log('📦 [BITRIX24 LOAD] Creando contenedor para el formulario...');
    // Crear contenedor para el formulario de Bitrix (oculto)
    let bitrixContainer = document.getElementById('bitrix-form-container');
    if (!bitrixContainer) {
      bitrixContainer = document.createElement('div');
      bitrixContainer.id = 'bitrix-form-container';
      bitrixContainer.style.cssText = 'position: absolute; left: -9999px; top: -9999px; visibility: hidden; pointer-events: none;';
      document.body.appendChild(bitrixContainer);
      console.log('✅ [BITRIX24 LOAD] Contenedor creado y agregado al DOM');
    } else {
      console.log('ℹ️ [BITRIX24 LOAD] Contenedor ya existía');
    }

    console.log('📜 [BITRIX24 LOAD] Creando script principal con IIFE (como Bitrix24 original)...');
    
    // Crear el script exactamente como Bitrix24 lo hace
    const mainScript = document.createElement('script');
    mainScript.setAttribute('data-b24-form', 'inline/348/em3lym');
    mainScript.setAttribute('data-skip-moving', 'true');
    
    // IIFE exacta de Bitrix24 que crea y carga el script del formulario
    mainScript.textContent = `
      (function(w,d,u){
        console.log('🔵 [BITRIX24 IIFE] Función de Bitrix24 ejecutándose...');
        console.log('🔵 [BITRIX24 IIFE] Creando script de carga del formulario...');
        var s=d.createElement('script');
        s.async=true;
        s.src=u+'?'+(Date.now()/180000|0);
        console.log('📡 [BITRIX24 IIFE] URL del loader:', s.src);
        var h=d.getElementsByTagName('script')[0];
        h.parentNode.insertBefore(s,h);
        console.log('✅ [BITRIX24 IIFE] Script del loader insertado antes del primer script');
        
        // Listener para cuando el script del loader termine de cargar
        s.onload = function() {
          console.log('✅ [BITRIX24 IIFE] Loader de Bitrix24 cargado');
        };
        
        s.onerror = function(error) {
          console.error('❌ [BITRIX24 IIFE] Error cargando el loader:', error);
        };
      })(window,document,'https://cdn.bitrix24.es/b13143615/crm/form/loader_348.js');
      
      console.log('✅ [BITRIX24 IIFE] IIFE de Bitrix24 ejecutada');
    `;
    
    console.log('➕ [BITRIX24 LOAD] Agregando script principal al contenedor...');
    bitrixContainer.appendChild(mainScript);
    console.log('✅ [BITRIX24 LOAD] Script principal agregado');
    
    // Esperar a que el formulario se renderice
    console.log('⏳ [BITRIX24 LOAD] Esperando 3 segundos para que el formulario se renderice completamente...');
    setTimeout(() => {
      console.log('🔍 [BITRIX24 LOAD] Buscando formulario renderizado...');
      
      const form = document.querySelector('[data-b24-form="inline/348/em3lym"]') || 
                   document.querySelector('iframe[src*="bitrix24"]') ||
                   document.querySelector('iframe[src*="b24"]') ||
                   document.querySelector('.b24-form');
      
      if (form) {
        console.log('✅ [BITRIX24 LOAD] Formulario de Bitrix24 detectado en el DOM');
        console.log('   - Tipo de elemento:', form.tagName);
        console.log('   - ID:', form.id || 'sin id');
        console.log('   - Clase:', form.className || 'sin clase');
        
        // Listar iframes encontrados
        const iframes = document.querySelectorAll('iframe');
        console.log(`   - Total de iframes en la página: ${iframes.length}`);
        iframes.forEach((iframe, index) => {
          console.log(`     * Iframe ${index + 1}: ${iframe.src || 'sin src'}`);
        });
        
        resolve();
      } else {
        console.warn('⚠️ [BITRIX24 LOAD] Formulario de Bitrix24 NO detectado visualmente');
        console.log('💡 [BITRIX24 LOAD] Esto puede ser normal si el formulario se carga dinámicamente');
        console.log('💡 [BITRIX24 LOAD] Continuando de todas formas...');
        
        // Mostrar todos los scripts cargados
        const allScripts = document.querySelectorAll('script');
        console.log(`📜 [BITRIX24 LOAD] Total de scripts en la página: ${allScripts.length}`);
        let bitrixScripts = 0;
        allScripts.forEach((script, index) => {
          if (script.src && (script.src.includes('bitrix24') || script.src.includes('b24'))) {
            console.log(`     * Script Bitrix24 #${++bitrixScripts}: ${script.src.substring(0, 80)}...`);
          }
        });
        
        resolve();
      }
    }, 3000);
  });
}

// Función para rellenar y enviar el formulario de Bitrix24
async function fillAndSubmitBitrix24Form(nombre, email, celular) {
  try {
    console.log('🔵 [BITRIX24] Iniciando llenado de formulario');
    console.log('📝 [BITRIX24] Datos a enviar:', { nombre, email, celular });
    
    // Esperar un poco más para asegurar que el formulario esté completamente cargado
    console.log('⏳ [BITRIX24] Esperando 1 segundo para que el formulario se renderice...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Buscar todos los iframes
    const allIframes = Array.from(document.querySelectorAll('iframe'));
    console.log(`🔍 [BITRIX24] Total de iframes encontrados: ${allIframes.length}`);
    allIframes.forEach((iframe, index) => {
      console.log(`   - Iframe ${index + 1}: ${iframe.src || iframe.id || 'sin identificación'}`);
    });
    
    // Buscar el iframe del formulario de Bitrix24
    const bitrixIframe = document.querySelector('iframe[src*="bitrix24"]') || 
                        document.querySelector('iframe[src*="b24-"]') ||
                        allIframes.find(iframe => {
                          const src = iframe.src || '';
                          return src.includes('bitrix') || src.includes('b24');
                        });
    
    if (bitrixIframe) {
      console.log('✅ [BITRIX24] Iframe de Bitrix24 encontrado:', bitrixIframe.src);
      console.log('🔍 [BITRIX24] Analizando iframe...');
      console.log('   - Width:', bitrixIframe.width);
      console.log('   - Height:', bitrixIframe.height);
      console.log('   - Display:', window.getComputedStyle(bitrixIframe).display);
      console.log('   - Visibility:', window.getComputedStyle(bitrixIframe).visibility);
      
      // Intentar acceder al contenido del iframe
      try {
        const iframeDoc = bitrixIframe.contentWindow.document;
        console.log('✅ [BITRIX24] Acceso al documento del iframe conseguido');
        
        // Listar todos los inputs
        const allInputs = iframeDoc.querySelectorAll('input');
        console.log(`🔍 [BITRIX24] Total de inputs en el iframe: ${allInputs.length}`);
        allInputs.forEach((input, index) => {
          console.log(`   - Input ${index + 1}:`, {
            type: input.type,
            name: input.name,
            placeholder: input.placeholder,
            id: input.id
          });
        });
        
        // Buscar campos en el iframe con múltiples estrategias
        console.log('🔍 [BITRIX24] Buscando campo de nombre...');
        const nombreField = iframeDoc.querySelector('input[name*="name"]') || 
                           iframeDoc.querySelector('input[placeholder*="nombre"]') ||
                           iframeDoc.querySelector('input[placeholder*="Nombre"]') ||
                           iframeDoc.querySelector('input[name*="NAME"]') ||
                           Array.from(allInputs).find(input => 
                             input.type === 'text' && 
                             (input.name.toLowerCase().includes('name') || 
                              input.placeholder.toLowerCase().includes('nombre'))
                           );
        
        console.log('🔍 [BITRIX24] Buscando campo de email...');
        const emailField = iframeDoc.querySelector('input[type="email"]') || 
                          iframeDoc.querySelector('input[name*="email"]') ||
                          iframeDoc.querySelector('input[name*="EMAIL"]') ||
                          Array.from(allInputs).find(input => 
                            input.type === 'email' || 
                            input.name.toLowerCase().includes('email')
                          );
        
        console.log('🔍 [BITRIX24] Buscando campo de teléfono/celular...');
        const celularField = iframeDoc.querySelector('input[type="tel"]') || 
                            iframeDoc.querySelector('input[name*="phone"]') ||
                            iframeDoc.querySelector('input[name*="PHONE"]') ||
                            iframeDoc.querySelector('input[name*="celular"]') ||
                            iframeDoc.querySelector('input[name*="telefono"]') ||
                            Array.from(allInputs).find(input => 
                              input.type === 'tel' || 
                              input.name.toLowerCase().includes('phone') ||
                              input.name.toLowerCase().includes('telefono') ||
                              input.name.toLowerCase().includes('celular')
                            );
        
        console.log('📊 [BITRIX24] Resultados de búsqueda de campos:');
        console.log('   - Campo nombre:', nombreField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
        console.log('   - Campo email:', emailField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
        console.log('   - Campo celular:', celularField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
        
        // Rellenar campos encontrados
        if (nombreField) {
          console.log('📝 [BITRIX24] Rellenando campo nombre...');
          nombreField.value = nombre;
          nombreField.dispatchEvent(new Event('input', { bubbles: true }));
          nombreField.dispatchEvent(new Event('change', { bubbles: true }));
          nombreField.dispatchEvent(new Event('blur', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo nombre rellenado:', nombreField.value);
        }
        
        if (emailField) {
          console.log('📝 [BITRIX24] Rellenando campo email...');
          emailField.value = email;
          emailField.dispatchEvent(new Event('input', { bubbles: true }));
          emailField.dispatchEvent(new Event('change', { bubbles: true }));
          emailField.dispatchEvent(new Event('blur', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo email rellenado:', emailField.value);
        }
        
        if (celularField) {
          console.log('📝 [BITRIX24] Rellenando campo celular...');
          celularField.value = celular;
          celularField.dispatchEvent(new Event('input', { bubbles: true }));
          celularField.dispatchEvent(new Event('change', { bubbles: true }));
          celularField.dispatchEvent(new Event('blur', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo celular rellenado:', celularField.value);
        }
        
        // Esperar un poco antes de enviar
        console.log('⏳ [BITRIX24] Esperando 500ms antes de buscar botón de envío...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Buscar botón de envío
        console.log('🔍 [BITRIX24] Buscando botón de envío...');
        const allButtons = iframeDoc.querySelectorAll('button');
        console.log(`   Total de botones: ${allButtons.length}`);
        allButtons.forEach((btn, index) => {
          console.log(`   - Botón ${index + 1}:`, {
            type: btn.type,
            className: btn.className,
            textContent: btn.textContent.trim().substring(0, 50)
          });
        });
        
        const submitBtn = iframeDoc.querySelector('button[type="submit"]') ||
                         iframeDoc.querySelector('.b24-form-btn') ||
                         iframeDoc.querySelector('button.btn-primary') ||
                         iframeDoc.querySelector('input[type="submit"]') ||
                         Array.from(allButtons).find(btn => 
                           btn.type === 'submit' || 
                           btn.textContent.toLowerCase().includes('enviar') ||
                           btn.textContent.toLowerCase().includes('submit')
                         );
        
        if (submitBtn) {
          console.log('✅ [BITRIX24] Botón de envío encontrado');
          console.log('🖱️ [BITRIX24] Haciendo clic en el botón...');
          submitBtn.click();
          console.log('✅ [BITRIX24] Formulario enviado exitosamente');
          return true;
        } else {
          console.warn('⚠️ [BITRIX24] Botón de envío NO encontrado');
          console.log('💡 [BITRIX24] Los datos fueron rellenados pero no se pudo enviar automáticamente');
          return false;
        }
      } catch (iframeError) {
        console.error('❌ [BITRIX24] No se pudo acceder al contenido del iframe (CORS):', iframeError);
        console.log('💡 [BITRIX24] Intentando método alternativo con postMessage...');
        
        bitrixIframe.contentWindow.postMessage({
          type: 'b24-form-fill',
          data: { nombre, email, celular }
        }, '*');
        
        console.log('📤 [BITRIX24] Mensaje postMessage enviado');
        return false;
      }
    } else {
      console.log('ℹ️ [BITRIX24] No se encontró iframe, buscando formulario directo en el DOM...');
      
      // Listar todos los inputs del DOM principal
      const allInputs = document.querySelectorAll('input');
      console.log(`🔍 [BITRIX24] Total de inputs en el DOM principal: ${allInputs.length}`);
      
      const nombreField = document.querySelector('input[name*="name"]') || 
                         document.querySelector('input[placeholder*="nombre"]') ||
                         document.querySelector('input[placeholder*="Nombre"]');
      const emailField = document.querySelector('input[type="email"]') || 
                        document.querySelector('input[name*="email"]');
      const celularField = document.querySelector('input[type="tel"]') || 
                          document.querySelector('input[name*="phone"]') ||
                          document.querySelector('input[name*="celular"]');
      
      console.log('📊 [BITRIX24] Resultados en DOM principal:');
      console.log('   - Campo nombre:', nombreField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
      console.log('   - Campo email:', emailField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
      console.log('   - Campo celular:', celularField ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
      
      if (nombreField || emailField || celularField) {
        if (nombreField) {
          nombreField.value = nombre;
          nombreField.dispatchEvent(new Event('input', { bubbles: true }));
          nombreField.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo nombre rellenado');
        }
        
        if (emailField) {
          emailField.value = email;
          emailField.dispatchEvent(new Event('input', { bubbles: true }));
          emailField.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo email rellenado');
        }
        
        if (celularField) {
          celularField.value = celular;
          celularField.dispatchEvent(new Event('input', { bubbles: true }));
          celularField.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('✅ [BITRIX24] Campo celular rellenado');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const submitBtn = document.querySelector('.b24-form button[type="submit"]') ||
                         document.querySelector('.b24-form-btn') ||
                         document.querySelector('button.btn-primary') ||
                         document.querySelector('input[type="submit"]');
        
        if (submitBtn) {
          submitBtn.click();
          console.log('✅ [BITRIX24] Formulario enviado');
          return true;
        }
      } else {
        console.warn('⚠️ [BITRIX24] No se encontraron campos del formulario');
      }
    }
    
    console.log('❌ [BITRIX24] No se pudo completar el envío automático');
    return false;
  } catch (error) {
    console.error('❌ [BITRIX24] Error crítico:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Función para actualizar Firestore con el email y preferencia de promociones
async function updateFirestoreWithEmail(email, acceptsPromotions) {
  if (!firebaseAvailable || !firestoreDocRef) {
    console.log('Firebase no disponible o documento no creado');
    return false;
  }
  
  try {
    await firestoreDocRef.update({ 
      email: email,
      acepta_promociones: acceptsPromotions,
      email_timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('✓ Email y preferencia de promociones guardados en Firestore');
    return true;
  } catch (error) {
    console.error('Error guardando email:', error);
    return false;
  }
}

// Función para actualizar Firestore con el número de WhatsApp
async function updateFirestoreWithWhatsApp(phoneNumber) {
  if (!firebaseAvailable || !firestoreDocRef) {
    console.log('Firebase no disponible o documento no creado');
    return false;
  }
  
  try {
    await firestoreDocRef.update({ 
      num_whats: phoneNumber,
      whatsapp_timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('✓ Número de WhatsApp guardado en Firestore');
    return true;
  } catch (error) {
    console.error('Error guardando número de WhatsApp:', error);
    return false;
  }
}

// Función para limpiar y formatear número de WhatsApp
function cleanPhoneNumber(phoneNumber, countryCode) {
    // Eliminar espacios y caracteres no numéricos
    let cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Eliminar el 0 inicial si existe
    if (cleanNumber.startsWith('0')) {
        cleanNumber = cleanNumber.substring(1);
    }
    
    // Unir código de país con número limpio
    const fullNumber = `${countryCode}${cleanNumber}`;
    
    console.log('Phone cleaning:', {
        original: phoneNumber,
        cleaned: cleanNumber,
        countryCode: countryCode,
        final: fullNumber
    });
    
    return {
        cleanNumber: cleanNumber,
        fullNumber: fullNumber
    };
}

// Función para manejar el envío de WhatsApp
async function handleWhatsAppSubmit() {
  const whatsappSendBtn = document.getElementById('whatsapp-send-btn');
  const countryCode = document.getElementById('country-code').value;
  const phoneInput = document.getElementById('phone-input');
  const phoneNumber = phoneInput.value.trim();
  
  // Verificar si el botón ya está deshabilitado
  if (whatsappSendBtn.disabled) {
    return;
  }
  
  if (!phoneNumber) {
    showAlert('Por favor ingresa tu número de WhatsApp');
    return;
  }
  
  // Validar que el número solo contenga dígitos
  if (!/^\d+$/.test(phoneNumber)) {
    showAlert('Por favor ingresa solo números en el campo de teléfono');
    return;
  }
  
  // Limpiar y formatear el número
  const { cleanNumber, fullNumber } = cleanPhoneNumber(phoneNumber, countryCode);
  
  // Validar longitud mínima y máxima para números de celular (usando número limpio)
  if (cleanNumber.length < 7) {
    showAlert('El número de teléfono debe tener al menos 7 dígitos');
    return;
  }
  
  if (cleanNumber.length > 15) {
    showAlert('El número de teléfono no puede tener más de 15 dígitos');
    return;
  }
  
  // Usar el número completo para envío
  const fullPhoneNumber = fullNumber;
  
  // Deshabilitar el botón inmediatamente
  whatsappSendBtn.disabled = true;
  whatsappSendBtn.innerHTML = '<span class="whatsapp-icon">⏳</span><span>Procesando...</span>';
  
  // Mostrar loader de pantalla completa
  showWhatsAppLoader();
  
  try {
    // Actualizar Firestore con el número de WhatsApp
    const firestoreSuccess = await updateFirestoreWithWhatsApp(fullPhoneNumber);
    
    // Simular tiempo de procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ocultar loader
    hideWhatsAppLoader();
    
    if (firestoreSuccess) {
      // Crear mensaje para WhatsApp
      const message = `Hola! Me interesa recibir más información sobre mi perfil DISC. Mi número es: ${fullPhoneNumber}`;
      const whatsappUrl = `https://wa.me/${fullPhoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;
      
      // Abrir WhatsApp
      window.open(whatsappUrl, '_blank');
      
      // Mostrar mensaje de confirmación
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: "✅ ¡Número guardado! Te contactaremos pronto.",
          duration: 5000,
          gravity: "top",
          position: "center",
          backgroundColor: "linear-gradient(to right, #25d366, #128c7e)",
          className: "toastify-success",
          style: {
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(37, 211, 102, 0.3)"
          }
        }).showToast();
      }
      
      // Cambiar el botón a estado de éxito
      whatsappSendBtn.innerHTML = '<span class="whatsapp-icon">✅</span><span>Enviado</span>';
      
      // Limpiar el formulario
      phoneInput.value = '';
    } else {
      // Si falla Firestore, aún permitir WhatsApp pero mostrar advertencia
      const message = `Hola! Me interesa recibir más información sobre mi perfil DISC. Mi número es: ${fullPhoneNumber}`;
      const whatsappUrl = `https://wa.me/${fullPhoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');
      
      whatsappSendBtn.innerHTML = '<span class="whatsapp-icon">📱</span><span>Enviar</span>';
      whatsappSendBtn.disabled = false;
      
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: "⚠️ Redirigiendo a WhatsApp. Hubo un problema guardando tu número, pero puedes contactarnos directamente.",
          duration: 5000,
          gravity: "top",
          position: "center",
          backgroundColor: "linear-gradient(to right, #f59e0b, #fbbf24)",
          className: "toastify-warning",
          style: {
            fontSize: "16px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)"
          }
        }).showToast();
      }
    }
  } catch (error) {
    console.error('Error en el proceso de WhatsApp:', error);
    hideWhatsAppLoader();
    
    // Restaurar botón en caso de error
    whatsappSendBtn.innerHTML = '<span class="whatsapp-icon">📱</span><span>Enviar</span>';
    whatsappSendBtn.disabled = false;
    
    showAlert('Hubo un error procesando tu solicitud. Por favor intenta nuevamente.');
  }
}

// Función para auto-rellenar el email en el formulario de Bitrix24
function autoFillBitrix24Email() {
  if (!userEmail) {
    console.log('⚠️ [BITRIX24 AUTOFILL] No hay email guardado para auto-rellenar');
    return false;
  }
  
  console.log('🔍 [BITRIX24 AUTOFILL] Buscando campo de email en formulario de Bitrix24...');
  console.log('📧 [BITRIX24 AUTOFILL] Email a rellenar:', userEmail);
  
  // Intentar encontrar el iframe del formulario
  const bitrixIframe = document.querySelector('iframe[src*="bitrix24"]') || 
                       document.querySelector('iframe[src*="b24-"]') ||
                       Array.from(document.querySelectorAll('iframe')).find(iframe => {
                         const src = iframe.src || '';
                         return src.includes('bitrix') || src.includes('b24');
                       });
  
  if (bitrixIframe) {
    console.log('✅ [BITRIX24 AUTOFILL] Iframe encontrado:', bitrixIframe.src);
    
    try {
      const iframeDoc = bitrixIframe.contentWindow.document;
      
      // Buscar campo de email
      const emailField = iframeDoc.querySelector('input[type="email"]') || 
                        iframeDoc.querySelector('input[name*="email"]') ||
                        iframeDoc.querySelector('input[name*="EMAIL"]') ||
                        Array.from(iframeDoc.querySelectorAll('input')).find(input => 
                          input.type === 'email' || 
                          input.name.toLowerCase().includes('email') ||
                          input.placeholder.toLowerCase().includes('email') ||
                          input.placeholder.toLowerCase().includes('correo')
                        );
      
      if (emailField && !emailField.value) {
        console.log('✅ [BITRIX24 AUTOFILL] Campo de email encontrado');
        emailField.value = userEmail;
        emailField.dispatchEvent(new Event('input', { bubbles: true }));
        emailField.dispatchEvent(new Event('change', { bubbles: true }));
        emailField.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('✅ [BITRIX24 AUTOFILL] Email auto-rellenado exitosamente:', userEmail);
        
        // Resaltar visualmente el campo para que el usuario sepa que se rellenó
        emailField.style.backgroundColor = '#e8f5e9';
        setTimeout(() => {
          emailField.style.backgroundColor = '';
        }, 2000);
        
        return true;
      } else if (emailField && emailField.value) {
        console.log('ℹ️ [BITRIX24 AUTOFILL] Campo de email ya tiene valor:', emailField.value);
        return true;
      } else {
        console.log('⚠️ [BITRIX24 AUTOFILL] Campo de email no encontrado en iframe');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ [BITRIX24 AUTOFILL] No se pudo acceder al iframe (CORS):', error.message);
      return false;
    }
  } else {
    // Buscar formulario directamente en el DOM
    console.log('🔍 [BITRIX24 AUTOFILL] Buscando formulario en el DOM principal...');
    
    const emailField = document.querySelector('#bitrix24-form-container input[type="email"]') || 
                      document.querySelector('#bitrix24-form-container input[name*="email"]') ||
                      Array.from(document.querySelectorAll('#bitrix24-form-container input')).find(input => 
                        input.type === 'email' || 
                        input.name.toLowerCase().includes('email') ||
                        input.placeholder.toLowerCase().includes('email') ||
                        input.placeholder.toLowerCase().includes('correo')
                      );
    
    if (emailField && !emailField.value) {
      console.log('✅ [BITRIX24 AUTOFILL] Campo de email encontrado en DOM');
      emailField.value = userEmail;
      emailField.dispatchEvent(new Event('input', { bubbles: true }));
      emailField.dispatchEvent(new Event('change', { bubbles: true }));
      emailField.dispatchEvent(new Event('blur', { bubbles: true }));
      console.log('✅ [BITRIX24 AUTOFILL] Email auto-rellenado exitosamente:', userEmail);
      
      // Resaltar visualmente el campo
      emailField.style.backgroundColor = '#e8f5e9';
      setTimeout(() => {
        emailField.style.backgroundColor = '';
      }, 2000);
      
      return true;
    } else if (emailField && emailField.value) {
      console.log('ℹ️ [BITRIX24 AUTOFILL] Campo de email ya tiene valor:', emailField.value);
      return true;
    } else {
      console.log('⚠️ [BITRIX24 AUTOFILL] Campo de email no encontrado en DOM');
      return false;
    }
  }
}

// Función para intentar auto-rellenar el email periódicamente
function startBitrix24EmailAutofill() {
  if (!userEmail) {
    console.log('⚠️ [BITRIX24 AUTOFILL] No hay email para auto-rellenar');
    return;
  }
  
  console.log('🔄 [BITRIX24 AUTOFILL] Iniciando auto-relleno periódico...');
  
  let attempts = 0;
  const maxAttempts = 20; // Intentar durante 20 segundos
  
  const interval = setInterval(() => {
    attempts++;
    console.log(`🔄 [BITRIX24 AUTOFILL] Intento ${attempts}/${maxAttempts}...`);
    
    const success = autoFillBitrix24Email();
    
    if (success) {
      console.log('✅ [BITRIX24 AUTOFILL] Auto-relleno completado exitosamente');
      clearInterval(interval);
      
      // Mostrar notificación al usuario
      if (typeof Toastify !== 'undefined') {
        Toastify({
          text: `✉️ Tu email (${userEmail}) se ha pre-llenado en el formulario`,
          duration: 5000,
          gravity: "bottom",
          position: "center",
          backgroundColor: "linear-gradient(to right, #22C55E, #16a34a)",
          style: {
            fontSize: "14px",
            fontWeight: "600",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(34, 197, 94, 0.3)"
          }
        }).showToast();
      }
    } else if (attempts >= maxAttempts) {
      console.log('⏱️ [BITRIX24 AUTOFILL] Tiempo máximo alcanzado, deteniendo intentos');
      clearInterval(interval);
    }
  }, 1000); // Intentar cada segundo
}

// Función de diagnóstico para Bitrix24
async function diagnosticarBitrix24() {
  console.log("=== DIAGNÓSTICO DE BITRIX24 ===");
  
  // 1. Verificar si el script está cargado
  const bitrixScript = document.querySelector('script[data-b24-form="inline/348/em3lym"]');
  console.log("1. Script principal de Bitrix24:", bitrixScript ? "✅ SÍ" : "❌ NO");
  if (bitrixScript) {
    console.log("   - Atributo data-b24-form:", bitrixScript.getAttribute('data-b24-form'));
    console.log("   - Atributo data-skip-moving:", bitrixScript.getAttribute('data-skip-moving'));
    console.log("   - Tiene contenido (IIFE):", bitrixScript.textContent.length > 0 ? "✅ SÍ" : "❌ NO");
  }
  
  // 1b. Verificar el script loader de Bitrix24
  const loaderScripts = Array.from(document.querySelectorAll('script')).filter(s => 
    s.src && s.src.includes('bitrix24.es/b13143615/crm/form/loader_348.js')
  );
  console.log("1b. Script(s) loader de Bitrix24:", loaderScripts.length);
  loaderScripts.forEach((script, index) => {
    console.log(`   - Loader ${index + 1}:`, script.src);
  })
  
  // 2. Verificar contenedor
  const bitrixContainer = document.getElementById('bitrix-form-container');
  console.log("2. Contenedor de Bitrix24:", bitrixContainer ? "✅ SÍ" : "❌ NO");
  if (bitrixContainer) {
    console.log("   - Visible:", bitrixContainer.style.visibility);
    console.log("   - HTML:", bitrixContainer.innerHTML.substring(0, 200) + "...");
  }
  
  // 3. Buscar iframes
  const allIframes = document.querySelectorAll('iframe');
  console.log("3. Total de iframes en la página:", allIframes.length);
  allIframes.forEach((iframe, index) => {
    console.log(`   - Iframe ${index + 1}:`, iframe.src || iframe.id || "sin src/id");
  });
  
  // 4. Buscar iframes específicos de Bitrix24
  const bitrixIframes = Array.from(allIframes).filter(iframe => 
    iframe.src.includes('bitrix24') || iframe.src.includes('b24-')
  );
  console.log("4. Iframes de Bitrix24 encontrados:", bitrixIframes.length);
  bitrixIframes.forEach((iframe, index) => {
    console.log(`   - Bitrix Iframe ${index + 1}:`, iframe.src);
  });
  
  // 5. Buscar formularios directos (sin iframe)
  const b24Forms = document.querySelectorAll('[data-b24-form]');
  console.log("5. Formularios Bitrix24 directos:", b24Forms.length);
  b24Forms.forEach((form, index) => {
    console.log(`   - Formulario ${index + 1}:`, form.getAttribute('data-b24-form'));
  });
  
  // 6. Verificar si hay objetos globales de Bitrix24
  console.log("6. Variables globales de Bitrix24:");
  console.log("   - window.b24form:", typeof window.b24form);
  console.log("   - window.BX24:", typeof window.BX24);
  
  console.log("=== FIN DIAGNÓSTICO DE BITRIX24 ===");
}

// Función de prueba para enviar a Bitrix24
async function probarEnvioBitrix24(nombre, email, celular) {
  console.log("=== PRUEBA DE ENVÍO A BITRIX24 ===");
  console.log("Datos a enviar:", { nombre, email, celular });
  
  // Primero cargar el formulario
  console.log("Paso 1: Cargando formulario de Bitrix24...");
  try {
    await loadBitrix24Form();
    console.log("✅ Formulario cargado");
  } catch (error) {
    console.error("❌ Error cargando formulario:", error);
    return false;
  }
  
  // Esperar un poco más
  console.log("Paso 2: Esperando renderización completa...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Diagnosticar
  await diagnosticarBitrix24();
  
  // Intentar rellenar y enviar
  console.log("Paso 3: Intentando rellenar y enviar...");
  const resultado = await fillAndSubmitBitrix24Form(nombre, email, celular);
  console.log("Resultado:", resultado ? "✅ ÉXITO" : "❌ FALLO");
  
  console.log("=== FIN PRUEBA ===");
  return resultado;
}

// Función para cargar el formulario de Bitrix24 de forma VISIBLE (para pruebas)
function cargarBitrix24Visible() {
  console.log('🔵 [BITRIX24 VISIBLE] Cargando formulario VISIBLE para pruebas...');
  
  // Eliminar contenedor oculto si existe
  const hiddenContainer = document.getElementById('bitrix-form-container');
  if (hiddenContainer) {
    hiddenContainer.remove();
    console.log('🗑️ [BITRIX24 VISIBLE] Contenedor oculto eliminado');
  }
  
  // Crear contenedor visible
  const visibleContainer = document.createElement('div');
  visibleContainer.id = 'bitrix-form-visible-container';
  visibleContainer.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 999999;
    max-width: 600px;
    width: 90%;
  `;
  
  // Título y botón de cerrar
  visibleContainer.innerHTML = `
    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <h2 style="margin: 0; color: #1982C4;">📋 Formulario Bitrix24 (Prueba)</h2>
      <button onclick="document.getElementById('bitrix-form-visible-container').remove()" 
              style="padding: 8px 16px; background: #e53935; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        Cerrar
      </button>
    </div>
    <div id="bitrix-form-content"></div>
  `;
  
  document.body.appendChild(visibleContainer);
  console.log('✅ [BITRIX24 VISIBLE] Contenedor visible creado');
  
  // Crear el script de Bitrix24
  const script = document.createElement('script');
  script.setAttribute('data-b24-form', 'inline/348/em3lym');
  script.setAttribute('data-skip-moving', 'true');
  script.textContent = `
    (function(w,d,u){
      console.log('🔵 [BITRIX24 VISIBLE] IIFE ejecutándose...');
      var s=d.createElement('script');
      s.async=true;
      s.src=u+'?'+(Date.now()/180000|0);
      console.log('📡 [BITRIX24 VISIBLE] URL:', s.src);
      var h=d.getElementsByTagName('script')[0];
      h.parentNode.insertBefore(s,h);
      console.log('✅ [BITRIX24 VISIBLE] Script insertado');
    })(window,document,'https://cdn.bitrix24.es/b13143615/crm/form/loader_348.js');
  `;
  
  document.getElementById('bitrix-form-content').appendChild(script);
  console.log('✅ [BITRIX24 VISIBLE] Formulario visible cargándose...');
  console.log('💡 [BITRIX24 VISIBLE] Espera unos segundos para ver el formulario renderizado');
}

// Agregar funciones globales para depuración
window.diagnosticarFirebase = diagnosticarFirebase;
window.forzarGuardadoRespuestas = forzarGuardadoRespuestas;
window.forzarCreacionDocumento = forzarCreacionDocumento;
window.diagnosticarBitrix24 = diagnosticarBitrix24;
window.probarEnvioBitrix24 = probarEnvioBitrix24;
window.cargarBitrix24Visible = cargarBitrix24Visible;
window.autoFillBitrix24Email = autoFillBitrix24Email;
window.startBitrix24EmailAutofill = startBitrix24EmailAutofill;

// Manejar click del botón submit - ahora como div normal
if (submitBtn) {
  submitBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!areAllQuestionsAnswered()) {
      showAlert("Aún faltan preguntas por responder. Por favor, completa todas.");
      return;
    }
    
    const scores = calculateScores();
    if (scores) {
      // Solicitar email y permisos al usuario antes de mostrar resultados
      const userData = await mostrarModalEmail();
      
      if (!userData) {
        // Usuario canceló, no hacer nada (quedarse en el test)
        return;
      }
      
      if (userData === 'complete') {
        // Usuario quiere completar preguntas, no hacer nada (quedarse en el test)
        return;
      }
      
      // Extraer datos del usuario
      const { email, acceptsPromotions } = userData;
      
      // Modelo resultado: { tipo, puntaje, descripcion }
      const maxScore = Math.max(...scores);
      const dominantTypeIndex = scores.indexOf(maxScore);
      const resultado = {
        tipo: (dominantTypeIndex + 1).toString(),
        puntaje: maxScore,
        descripcion: obtenerDescripcionTipo(dominantTypeIndex + 1),
        puntuaciones: {
          D: Math.round(scores[0]),
          I: Math.round(scores[1]), 
          S: Math.round(scores[2]),
          C: Math.round(scores[3])
        }
      };
      
      // Preparar respuestas para guardado
      const respuestasObj = {};
      userResponses.forEach((resp, idx) => {
        if (resp !== null && resp.most !== null && resp.least !== null) {
          respuestasObj[`p${idx + 1}`] = {
            most: resp.most,
            least: resp.least,
            mostDimension: resp.mostDimension,
            leastDimension: resp.leastDimension
          };
        }
      });
      
      // Mostrar loader mientras se procesan los resultados
      showResultsLoader();
      
      // Crear documento en Firestore con el email proporcionado
      try {
        await crearDocumentoFirestore(email);
        await actualizarRespuestasFirestore();
        await actualizarResultadoFirestore(resultado);
        console.log("Resultado guardado en Firebase");
      } catch (error) {
        console.error("Error guardando en Firebase, usando respaldo local:", error);
        guardarResultadoLocal(email, resultado, respuestasObj);
      }
      
      // Mostrar resultados después de un breve delay
      setTimeout(() => {
        hideResultsLoader();
        displayResults(scores);
        
        // NOTA: El formulario de Bitrix24 se carga automáticamente desde el HTML
        // cuando se muestra el contenedor de resultados (#results-container).
        // No es necesario cargarlo manualmente desde JavaScript.
        // El script está en: index.html, líneas 135-143
        console.log('✅ Formulario de Bitrix24 disponible en la página de resultados');
        console.log('📋 El usuario puede llenarlo opcionalmente para recibir más información');
        
        // Iniciar auto-relleno del email en el formulario de Bitrix24
        setTimeout(() => {
          console.log('🔄 Iniciando auto-relleno de email en formulario de Bitrix24...');
          startBitrix24EmailAutofill();
        }, 2000); // Esperar 2 segundos para que el formulario se cargue
        
        // Notificación amigable informando sobre el formulario
        if (typeof Toastify !== 'undefined') {
          setTimeout(() => {
            Toastify({
              text: "💡 Desplázate hacia abajo para llenar el formulario de contacto si deseas más información",
              duration: 6000,
              gravity: "bottom",
              position: "center",
              backgroundColor: "linear-gradient(to right, #1982C4, #FF595E)",
              style: {
                fontSize: "15px",
                fontWeight: "600",
                borderRadius: "12px",
                boxShadow: "0 4px 15px rgba(25, 130, 196, 0.3)"
              }
            }).showToast();
          }, 1000);
        }
      }, 2000);
    }
  });
} else {
  console.error("Elemento submitBtn no encontrado.");
}

// Devuelve la descripción del tipo (puedes personalizar)
function obtenerDescripcionTipo(tipo) {
  const descripciones = {
    1: "Dominancia: Directo, decidido, orientado a resultados y competitivo.",
    2: "Influencia: Sociable, persuasivo, optimista y entusiasta.",
    3: "Estabilidad: Paciente, confiable, cooperativo y calmado.",
    4: "Cumplimiento: Analítico, meticuloso, preciso y orientado a normas.",
  };
  return descripciones[tipo] || "";
}

// Event listener para el botón de WhatsApp
document.addEventListener('DOMContentLoaded', function() {
  const whatsappSendBtn = document.getElementById('whatsapp-send-btn');
  const phoneInput = document.getElementById('phone-input');
  
  if (whatsappSendBtn) {
    whatsappSendBtn.addEventListener('click', handleWhatsAppSubmit);
  }
  
  // Permitir envío con Enter en el campo de teléfono
  if (phoneInput) {
    phoneInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        handleWhatsAppSubmit();
      }
    });
    
    // Solo permitir números en el campo de teléfono
    phoneInput.addEventListener('input', function(e) {
      // Remover cualquier carácter que no sea número
      let value = e.target.value.replace(/[^0-9]/g, '');
      
      // Limitar a 15 dígitos
      if (value.length > 15) {
        value = value.substring(0, 15);
      }
      
      e.target.value = value;
    });
    
    // Prevenir pegar texto que no sean números
    phoneInput.addEventListener('paste', function(e) {
      e.preventDefault();
      let paste = (e.clipboardData || window.clipboardData).getData('text');
      let numbersOnly = paste.replace(/[^0-9]/g, '');
      if (numbersOnly.length > 15) {
        numbersOnly = numbersOnly.substring(0, 15);
      }
      e.target.value = numbersOnly;
    });
  }
});

/*
╔═══════════════════════════════════════════════════════════════════════════════╗
║                    GUÍA DE DEPURACIÓN DE BITRIX24                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝

Para diagnosticar problemas con el envío a Bitrix24, abre la CONSOLA DEL NAVEGADOR
(F12 o Cmd+Option+I) y ejecuta estos comandos:

1️⃣ DIAGNÓSTICO COMPLETO DE BITRIX24:
   
   diagnosticarBitrix24()
   
   Esto mostrará:
   - Si el script de Bitrix24 está cargado
   - Si hay contenedor de Bitrix24
   - Lista de todos los iframes en la página
   - Iframes específicos de Bitrix24
   - Variables globales de Bitrix24

2️⃣ PROBAR ENVÍO MANUAL A BITRIX24:
   
   probarEnvioBitrix24("Juan Pérez", "juan@ejemplo.com", "1234567890")
   
   Esto hará una prueba completa:
   - Cargará el formulario de Bitrix24
   - Mostrará diagnóstico detallado
   - Intentará rellenar y enviar los datos
   - Te dirá si fue exitoso o no

3️⃣ VER LOGS DURANTE EL TEST:
   
   Cuando completes el test y hagas clic en "Ver resultados", verás en la consola
   todos los pasos que se ejecutan con prefijos como:
   
   🔵 [BITRIX24 LOAD] - Carga del formulario
   🔵 [BITRIX24] - Llenado y envío del formulario
   ✅ - Éxito
   ⚠️ - Advertencia
   ❌ - Error

4️⃣ DIAGNÓSTICO DE FIREBASE (si es necesario):
   
   diagnosticarFirebase()

═══════════════════════════════════════════════════════════════════════════════

PROBLEMAS COMUNES Y SOLUCIONES:

❓ Problema: "No se encontraron iframes de Bitrix24"
   Solución: El formulario puede no haberse cargado. Espera unos segundos y ejecuta
             diagnosticarBitrix24() nuevamente.

❓ Problema: "No se pudo acceder al contenido del iframe (CORS)"
   Solución: Esto es normal si Bitrix24 usa un dominio diferente. Los datos se
             intentarán enviar mediante postMessage.

❓ Problema: "Botón de envío NO encontrado"
   Solución: Los datos se rellenaron pero no se pudo hacer clic automáticamente.
             Puedes enviar el formulario manualmente.

❓ Problema: "Campos del formulario NO encontrados"
   Solución: El formulario puede tener nombres de campos diferentes. 
             Ejecuta diagnosticarBitrix24() y mira la lista de inputs para
             identificar los nombres correctos.

═══════════════════════════════════════════════════════════════════════════════

VERIFICAR SI LOS DATOS LLEGARON A BITRIX24:

1. Ve a tu panel de Bitrix24: https://b13143615.bitrix24.es/
2. Ve a CRM → Formularios → Formulario 348
3. Revisa las últimas entradas
4. Verifica si los datos del test aparecen ahí

═══════════════════════════════════════════════════════════════════════════════
*/