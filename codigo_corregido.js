// 2) Inicializar una sola vez
// const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables globales
let shuffledQuestions = [];
let userResponses = [];
let currentPage = 1;
const questionsPerPage = 20;

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
      version_test: "disc_v1.0",
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
      if (resp !== null) {
        respuestasObj[`p${idx + 1}`] = resp.toString();
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
      version: "disc_v1.0"
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
            <input type="checkbox" id="modal-promociones-checkbox" required
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
      const promocionesValid = promocionesCheckbox.checked;
      
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
      
      // Validar que todos los campos estén completos
      const todoValido = emailValid && consentimientoValid && promocionesValid && todasRespondidas;
      
      if (todoValido) {
        emailInput.style.borderColor = '#2ecc40';
        saveBtn.disabled = false;
        errorDiv.style.display = 'none';
      } else {
        emailInput.style.borderColor = email.length > 0 && !emailValid ? '#e74c3c' : '#ddd';
        saveBtn.disabled = true;
        errorDiv.style.display = 'none'; // Ocultar mensajes de error en validación en tiempo real
      }
    }

    // Validación de email en tiempo real
    emailInput.addEventListener('input', validateForm);
    
    // Validación de checkboxes
    consentimientoCheckbox.addEventListener('change', validateForm);
    promocionesCheckbox.addEventListener('change', validateForm);

    // Event listeners
    saveBtn.addEventListener('click', function() {
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
      
      if (!consentimientoValid || !promocionesValid) {
        const faltantes = [];
        if (!consentimientoValid) faltantes.push('• Términos y condiciones');
        if (!promocionesValid) faltantes.push('• Autorización de correos');
        
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
      
      // Si todo está válido, proceder
      document.body.removeChild(modal);
      resolve(email);
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
    
    // Focus en el input
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

// --- PREGUNTAS DISC (32 en total, 8 por tipo) ---
// Test DISC clásico con 4 dimensiones: Dominancia, Influencia, Estabilidad, Cumplimiento
const allQuestionsData = [
  // Dominancia (D) - 8 preguntas
  { text: "Me gusta tomar decisiones rápidamente.", type: 1 },
  { text: "Prefiero liderar que seguir a otros.", type: 1 },
  { text: "Me siento cómodo asumiendo riesgos.", type: 1 },
  { text: "Me gusta enfrentar desafíos.", type: 1 },
  { text: "Soy directo al comunicarme.", type: 1 },
  { text: "Me motiva lograr resultados.", type: 1 },
  { text: "No temo expresar opiniones fuertes.", type: 1 },
  { text: "Prefiero actuar que esperar.", type: 1 },
  
  // Influencia (I) - 8 preguntas
  { text: "Disfruto socializar con otras personas.", type: 2 },
  { text: "Me gusta motivar y animar a otros.", type: 2 },
  { text: "Soy optimista y entusiasta.", type: 2 },
  { text: "Me adapto fácilmente a nuevas situaciones.", type: 2 },
  { text: "Me gusta trabajar en equipo.", type: 2 },
  { text: "Me siento cómodo hablando en público.", type: 2 },
  { text: "Me gusta persuadir a los demás.", type: 2 },
  { text: "Disfruto ser el centro de atención.", type: 2 },
  
  // Estabilidad (S) - 8 preguntas
  { text: "Prefiero ambientes tranquilos y estables.", type: 3 },
  { text: "Me gusta ayudar a los demás.", type: 3 },
  { text: "Soy paciente y tolerante.", type: 3 },
  { text: "Evito los conflictos siempre que puedo.", type: 3 },
  { text: "Me adapto a las necesidades de los demás.", type: 3 },
  { text: "Me gusta mantener rutinas.", type: 3 },
  { text: "Soy una persona confiable.", type: 3 },
  { text: "Prefiero escuchar antes que hablar.", type: 3 },
  
  // Cumplimiento (C) - 8 preguntas
  { text: "Me gusta seguir reglas y procedimientos.", type: 4 },
  { text: "Soy detallista y meticuloso.", type: 4 },
  { text: "Prefiero planificar antes de actuar.", type: 4 },
  { text: "Me gusta analizar la información antes de decidir.", type: 4 },
  { text: "Valoro la precisión en mi trabajo.", type: 4 },
  { text: "Me incomoda la improvisación.", type: 4 },
  { text: "Prefiero tareas que requieren concentración.", type: 4 },
  { text: "Me esfuerzo por evitar errores.", type: 4 },
];

const typeColors = [
  "#FF595E", // Dominancia
  "#FFCA3A", // Influencia
  "#22C55E", // Estabilidad (verde más estándar)
  "#1982C4", // Cumplimiento
];
const typeLabels = ["Dominancia", "Influencia", "Estabilidad", "Cumplimiento"];
const grayColor = "#CCCCCC";

// Función para inicializar el quiz
function initializeQuiz() {
  if (!quizContainer || !quizForm || !paginationControlsDiv) {
    console.error("Elementos del quiz no encontrados");
    return;
  }

  // Validar que tenemos preguntas
  if (!allQuestionsData || allQuestionsData.length === 0) {
    console.error("No hay preguntas disponibles");
    showAlert("Error: No hay preguntas disponibles para el test.");
    return;
  }

  // Mezclar preguntas aleatoriamente
  shuffledQuestions = [...allQuestionsData].sort(() => Math.random() - 0.5);
  userResponses = new Array(shuffledQuestions.length).fill(null);
  currentPage = 1;
  
  console.log(`Test inicializado con ${shuffledQuestions.length} preguntas`);

  // Mostrar el formulario del quiz
  startTestContainer.style.display = "none";
  quizForm.style.display = "block";
  paginationControlsDiv.style.display = "block";

  // Crear botones de paginación
  createPaginationButtons();
  
  // Renderizar primera página
  renderCurrentPage();
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
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
      updatePaginationButtons();
      
      // Scroll suave hacia la parte superior de la página
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  });

  nextBtn.addEventListener("click", async () => {
    if (!areCurrentPageQuestionsAnswered()) {
      showAlert(
        "Por favor, responde todas las preguntas de esta página antes de continuar."
      );
      return;
    }

    // Ya no guardamos respuestas al cambiar de página - solo al final

    const totalPages = Math.ceil(shuffledQuestions.length / questionsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
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

function renderCurrentPage() {
  if (!quizContainer) return;
  quizContainer.innerHTML = `<div class="pagination-indicator" style="margin-bottom:15px; font-weight:bold;">
        Página ${currentPage}/${Math.ceil(
    shuffledQuestions.length / questionsPerPage
  )}</div>`;

  const startIdx = (currentPage - 1) * questionsPerPage;
  const endIdx = Math.min(
    startIdx + questionsPerPage,
    shuffledQuestions.length
  );

  for (let i = startIdx; i < endIdx; i++) {
    const question = shuffledQuestions[i];
    const questionDiv = document.createElement("div");
    questionDiv.className = "question ui-card";
    questionDiv.id = `question-global-${i}`;

    const questionText = document.createElement("div");
    questionText.className = "question-text ui-card-title";
    questionText.textContent = question.text;
    questionDiv.appendChild(questionText);

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "options ui-options";
    optionsDiv.style.display = "flex";
    optionsDiv.style.alignItems = "center";
    optionsDiv.style.justifyContent = "space-between";
    optionsDiv.style.gap = "10px";

    // Texto al inicio: Nada identificado
    const startLabel = document.createElement("span");
    startLabel.textContent = "Nada identificado";
    startLabel.style.fontSize = "0.9em";
    startLabel.style.whiteSpace = "nowrap";
    optionsDiv.appendChild(startLabel);

    for (let value = 1; value <= 5; value++) {
      const label = document.createElement("label");
      label.className = "ui-option-label";
      label.style.display = "flex";
      label.style.flexDirection = "column";
      label.style.alignItems = "center";
      label.style.position = "relative";
      label.style.transition = "box-shadow 0.2s, border-color 0.2s";

      // Icono visual (puedes cambiar el emoji por SVG si lo prefieres)
      const icon = document.createElement("span");
      icon.className = "ui-option-icon";
      icon.style.fontSize = "1.2em";
      icon.style.marginBottom = "2px";
      icon.textContent = value === 1 ? "😐" : value === 5 ? "😃" : "🙂";
      label.appendChild(icon);

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question-${i}`;
      input.value = value;
      input.style.marginBottom = "4px";

      if (userResponses[i] === value) {
        input.checked = true;
        label.style.background = "#e3f2fd";
        label.style.boxShadow = "0 2px 8px rgba(63,81,181,0.08)";
        label.style.borderColor = "#3f51b5";
      }

      input.addEventListener("change", () => {
        userResponses[i] = parseInt(input.value);
        // Animación y feedback visual
        document.querySelectorAll(`[name='question-${i}']`).forEach((el) => {
          el.parentElement.style.background = "#fff";
          el.parentElement.style.boxShadow = "none";
          el.parentElement.style.borderColor = "#ccc";
        });
        label.style.background = "#e3f2fd";
        label.style.boxShadow = "0 2px 8px rgba(63,81,181,0.08)";
        label.style.borderColor = "#3f51b5";
        hideAlert();
        updateSubmitButtonVisibility();
      });

      const span = document.createElement("span");
      span.textContent = value;
      span.style.fontWeight = "bold";
      label.appendChild(input);
      label.appendChild(span);
      optionsDiv.appendChild(label);
    }

    const endLabel = document.createElement("span");
    endLabel.textContent = "Muy identificado";
    endLabel.style.fontSize = "0.9em";
    endLabel.style.whiteSpace = "nowrap";
    optionsDiv.appendChild(endLabel);

    questionDiv.appendChild(optionsDiv);
    quizContainer.appendChild(questionDiv);
  }
  // Indicador inferior (footer)
  const footer = document.createElement("div");
  footer.className = "pagination-indicator";
  footer.style.marginTop = "15px";
  footer.style.fontWeight = "bold";
  footer.style.textAlign = "center"; // opcional
  footer.textContent = `Página ${currentPage}/${Math.ceil(
    shuffledQuestions.length / questionsPerPage
  )}`;
  quizContainer.appendChild(footer);
}

function updatePaginationButtons() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  if (!prevBtn || !nextBtn || !submitBtn) return;

  const totalPages = Math.ceil(shuffledQuestions.length / questionsPerPage);
  prevBtn.disabled = currentPage === 1;

  // Mostrar u ocultar el botón "Siguiente"
  if (currentPage === totalPages) {
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
  if (userResponses.length !== shuffledQuestions.length) {
    console.error(
      `Longitud de respuestas (${userResponses.length}) no coincide con preguntas (${shuffledQuestions.length})`
    );
    showAlert("Error al procesar respuestas. Intenta recargar la página.");
    return null;
  }
  
  if (!areAllQuestionsAnswered()) {
    // Encontrar la primera pregunta sin responder
    for (let i = 0; i < userResponses.length; i++) {
      if (userResponses[i] === null) {
        const pageOfMissingQuestion = Math.floor(i / questionsPerPage) + 1;
        currentPage = pageOfMissingQuestion;
        renderCurrentPage();
        updatePaginationButtons();
        setTimeout(() => {
          const missingQuestionDiv = document.querySelector(
            `#question-global-${i}`
          );
          if (missingQuestionDiv) {
            missingQuestionDiv.style.borderColor = "red";
            missingQuestionDiv.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
          showAlert(
            "Aún faltan preguntas por responder. Por favor, completa todas."
          );
        }, 100);
        return null;
      }
    }
  }
  
  hideAlert();

  const scores = Array(numTypes).fill(0);
  userResponses.forEach((responseValue, globalIndex) => {
    if (
      shuffledQuestions[globalIndex] &&
      typeof shuffledQuestions[globalIndex].type !== "undefined"
    ) {
      const originalType = shuffledQuestions[globalIndex].type;
      // En DISC, los tipos van directamente del 1 al 4
      scores[originalType - 1] += responseValue;
    } else {
      console.error(
        `Pregunta indefinida o sin tipo en el índice global ${globalIndex}`
      );
    }
  });
  return scores;
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

  // Mostrar los resultados directamente ya que el loader se maneja externamente
  resultsContainer.style.display = "block";

    const maxScore = Math.max(...scores);
    const dominantTypeIndex = scores.indexOf(maxScore);
    const dominantType = dominantTypeIndex + 1;

  // Obtener el color del tipo dominante
  const dominantColor = typeColors[dominantTypeIndex];
  
  // Debug: verificar valores
  console.log('=== DEBUG DISC RESULTS ===');
  console.log('Scores array:', scores);
  console.log('Max Score:', maxScore);
  console.log('Dominant Type Index:', dominantTypeIndex);
  console.log('Type Labels:', typeLabels);
  console.log('Type Colors:', typeColors);
  console.log('Selected Type:', typeLabels[dominantTypeIndex]);
  console.log('Selected Color:', typeColors[dominantTypeIndex]);
  console.log('Expected colors:');
  console.log('- Dominancia (index 0):', typeColors[0], '(should be red)');
  console.log('- Influencia (index 1):', typeColors[1], '(should be yellow)');
  console.log('- Estabilidad (index 2):', typeColors[2], '(should be green)');
  console.log('- Cumplimiento (index 3):', typeColors[3], '(should be blue)');
  console.log('========================');
  
    // Determinar la clase CSS basada en el tipo
    let discClass = '';
    if (typeLabels[dominantTypeIndex] === 'Dominancia') {
      discClass = 'disc-result-dominancia';
    } else if (typeLabels[dominantTypeIndex] === 'Influencia') {
      discClass = 'disc-result-influencia';
    } else if (typeLabels[dominantTypeIndex] === 'Estabilidad') {
      discClass = 'disc-result-estabilidad';
    } else if (typeLabels[dominantTypeIndex] === 'Cumplimiento') {
      discClass = 'disc-result-cumplimiento';
    }

    console.log('Using CSS class:', discClass, 'for type:', typeLabels[dominantTypeIndex]);

    resultsTextDiv.innerHTML = `<p class="dominant-type" style="color: #2d3748; font-weight: 600;">Tu estilo DISC predominante es: <span class="${discClass}">${typeLabels[dominantTypeIndex]}</span></p>`;

    drawChart(scores, dominantTypeIndex);

    paginationControlsDiv.style.display = "none";
    submitBtn.style.display = "none";
    quizForm.style.display = "none";

    if (typeDescriptions && typeDescriptions.length > 0) {
      typeDescriptions.forEach((desc) => (desc.style.display = "none"));

      const dominantTypeDesc = document.querySelector(`#type-${dominantType}`);
      if (dominantTypeDesc) {
        dominantTypeDesc.style.display = "block";
        dominantTypeDesc.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      console.warn(
        "No se encontraron descripciones de tipos para mostrar/ocultar"
      );
    }

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    resultsTextDiv.innerHTML += `
            <p style="color:#2ecc71;font-weight:bold;margin-top:15px;">
                ¡Qué lindo ser quien eres! ¡Celebra tu tipo de comportamiento único! 🎉
            </p>
            <div class="final-message" style="margin-top:20px;font-size:1.1em;">
                Ahora que conoces tu tipo, aprovecha estas características únicas para seguir creciendo y desarrollándote. ¡El mundo necesita exactamente quién eres!
            </div>
        `;

    resultsContainer.scrollIntoView({ behavior: "smooth" });
}

function drawChart(scores, dominantTypeIndex) {
  const chartCanvas = document.querySelector("#results-chart");
  if (!chartCanvas) return;
  const chartCtx = chartCanvas.getContext("2d");
  if (resultsChart) resultsChart.destroy();

  let questionsPerType = 0;
  if (shuffledQuestions.length > 0) {
    questionsPerType = shuffledQuestions.filter((q) => q.type === 1).length;
  }
  const maxScorePerType = questionsPerType * 5;

  // Mostrar todos los colores, pero destacar el dominante
  const backgroundColors = [...typeColors];
  const borderColors = [...typeColors];
  
  // Hacer el tipo dominante más opaco y los otros más transparentes
  for (let i = 0; i < numTypes; i++) {
    if (i === dominantTypeIndex) {
      backgroundColors[i] = typeColors[i];
    } else {
      // Hacer los otros tipos más transparentes
      backgroundColors[i] = typeColors[i] + '80'; // 50% opacity
    }
  }

  // Configuración del gráfico de barras
  resultsChart = new Chart(chartCtx, {
    type: "bar", // Cambiado a gráfico de barras
    data: {
      labels: typeLabels,
      datasets: [
        {
          label: "Puntuación",
          data: scores,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: maxScorePerType > 0 ? maxScorePerType : 40,
          ticks: {
            stepSize: 5
          }
        },
        x: {
          ticks: {
            font: { size: 14, weight: "bold" }
          }
        }
      },
      plugins: {
        legend: {
          display: false, // Ocultar la leyenda
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed.y} puntos`;
            }
          }
        },
      },
      layout: {
        padding: 20,
      },
    },
  });
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

    currentPage = 1;
    shuffledQuestions = [];
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

// Agregar funciones globales para depuración
window.diagnosticarFirebase = diagnosticarFirebase;
window.forzarGuardadoRespuestas = forzarGuardadoRespuestas;
window.forzarCreacionDocumento = forzarCreacionDocumento;

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
      // Solicitar email al usuario antes de guardar
      const email = await mostrarModalEmail();
      
      if (!email) {
        // Usuario canceló, no hacer nada (quedarse en el test)
        return;
      }
      
      if (email === 'complete') {
        // Usuario quiere completar preguntas, no hacer nada (quedarse en el test)
        return;
      }
      
      // Modelo resultado: { tipo, puntaje, descripcion }
      const maxScore = Math.max(...scores);
      const dominantTypeIndex = scores.indexOf(maxScore);
      const resultado = {
        tipo: (dominantTypeIndex + 1).toString(),
        puntaje: maxScore,
        descripcion: obtenerDescripcionTipo(dominantTypeIndex + 1),
      };
      
      // Preparar respuestas para guardado
      const respuestasObj = {};
      userResponses.forEach((resp, idx) => {
        if (resp !== null) {
          respuestasObj[`p${idx + 1}`] = resp.toString();
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
      
      // Simular tiempo de procesamiento para mostrar el loader
      setTimeout(() => {
        hideResultsLoader();
        displayResults(scores);
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