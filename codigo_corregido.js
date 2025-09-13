// 2) Inicializar una sola vez
// const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables globales
let shuffledQuestions = [];
let userResponses = [];
let currentPage = 1;
const questionsPerPage = 20;

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
    paintStatus(
      `⚠ Error de Firebase: ${e.code || e.message}. Modo offline activado.`,
      "#e53935"
    );
    return false;
  }
}

// 4) Al cargar el DOM, probar lectura
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar Firebase primero
  await initializeFirebase();
  
  if (!firebaseAvailable) {
    paintStatus("⚠ Modo offline: Los resultados se guardarán localmente", "#f57c00");
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
          
          paintStatus("✔ Conectado a Firestore", "#388e3c");
          console.log("Conexión a Firestore exitosa");
        } catch (error) {
          console.error("Error en prueba de Firestore:", error);
          console.error("Código de error:", error.code);
          console.error("Mensaje:", error.message);
          
          // Solo marcar como no disponible si es un error crítico
          if (error.code === "unavailable" || error.code === "unauthenticated") {
            firebaseAvailable = false;
            paintStatus(
              `⚠ Error crítico de Firestore: ${error.code}. Modo offline activado.`,
              "#e53935"
            );
          } else if (error.code === "permission-denied") {
            // Para errores de permisos, mantener Firebase disponible pero mostrar advertencia
            console.warn("Advertencia: Permisos limitados en Firestore, pero continuando...");
            paintStatus(
              "⚠ Advertencia: Permisos limitados en Firestore. Algunas operaciones pueden fallar.",
              "#f57c00"
            );
          } else {
            // Para otros errores, mantener Firebase disponible
            console.warn("Error no crítico en Firestore, continuando...");
            paintStatus(
              `⚠ Advertencia: ${error.code || error.message}. Continuando con limitaciones.`,
              "#f57c00"
            );
          }
        }
      } else {
        console.log("No hay usuario autenticado");
        firebaseAvailable = false;
        paintStatus("⚠ No autenticado. Modo offline activado.", "#e53935");
      }
    });
  } catch (error) {
    console.error("Error de inicialización de Firebase:", error);
    firebaseAvailable = false;
    paintStatus("⚠ Error de inicialización de Firebase. Modo offline activado.", "#e53935");
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

// Mejoras UI/UX para el campo de email (después de inicializar todas las variables DOM)
setTimeout(() => {
  const emailInput = document.getElementById("user-email");
  const emailForm = document.getElementById("email-form");
  let emailValido = false;
  if (emailInput && startTestBtn) {
    startTestBtn.disabled = true;
    emailInput.addEventListener("input", function () {
      const valor = emailInput.value.trim();
      const esValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor);
      emailValido = esValido;
      if (esValido) {
        emailInput.style.borderColor = "#2ecc40";
        startTestBtn.disabled = false;
        hideAlert();
      } else {
        emailInput.style.borderColor = valor.length > 0 ? "#e74c3c" : "#ccc";
        startTestBtn.disabled = true;
      }
    });
    startTestBtn.addEventListener("click", function (e) {
      if (!emailValido) {
        e.preventDefault();
        showAlert("Por favor ingresa un email válido para comenzar.");
        emailInput.focus();
        return;
      }
      hideAlert();
    });
  }
}, 0);

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
  "#8AC926", // Estabilidad
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
    }
  });

  nextBtn.addEventListener("click", async () => {
    if (!areCurrentPageQuestionsAnswered()) {
      showAlert(
        "Por favor, responde todas las preguntas de esta página antes de continuar."
      );
      return;
    }

    // Guardar/actualizar respuestas parciales en Firestore
    console.log("Guardando respuestas al cambiar de página...");
    try {
      await actualizarRespuestasFirestore();
    } catch (error) {
      console.error("Error guardando respuestas en cambio de página:", error);
    }

    const totalPages = Math.ceil(shuffledQuestions.length / questionsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
      updatePaginationButtons();
      setTimeout(() => {
        quizContainer.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const loadingSpinner = document.querySelector("#loading-spinner");
  loadingSpinner.style.display = "block";
  resultsContainer.style.display = "none";

  setTimeout(() => {
    loadingSpinner.style.display = "none";
    resultsContainer.style.display = "block";

    const maxScore = Math.max(...scores);
    const dominantTypeIndex = scores.indexOf(maxScore);
    const dominantType = dominantTypeIndex + 1;

  resultsTextDiv.innerHTML = `<p class="dominant-type">Tu estilo DISC predominante es: <strong>${typeLabels[dominantTypeIndex]}</strong></p>`;

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
                ¡Qué lindo ser quien eres! ¡Celebra tu tipo de personalidad único! 🎉
            </p>
            <div class="final-message" style="margin-top:20px;font-size:1.1em;">
                Ahora que conoces tu tipo, aprovecha estas características únicas para seguir creciendo y desarrollándote. ¡El mundo necesita exactamente quién eres!
            </div>
        `;

    resultsContainer.scrollIntoView({ behavior: "smooth" });
  }, 2500);
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

  // Crear array de colores donde solo el tipo dominante tiene color
  const backgroundColors = Array(numTypes).fill(grayColor);
  backgroundColors[dominantTypeIndex] = typeColors[dominantTypeIndex];

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
          borderColor: typeColors,
          borderWidth: 2,
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

// Evento para iniciar test
if (startTestBtn) {
  startTestBtn.addEventListener("click", async function () {
    const emailInput = document.getElementById("user-email");
    const emailDisplay = document.getElementById("user-email-display");
    if (emailInput && emailDisplay) {
      emailDisplay.textContent = `Usuario: ${emailInput.value}`;
      emailDisplay.style.display = "block";
    }
    
    // Ejecutar diagnóstico
    diagnosticarFirebase();
    
    // Crear documento en Firestore al iniciar el test
    try {
      await crearDocumentoFirestore(emailInput.value);
      console.log("Documento creado exitosamente");
    } catch (error) {
      console.error("Error creando documento:", error);
      // Continuar con el test aunque falle Firebase
    }
    
    initializeQuiz();
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

// Agregar funciones globales para depuración
window.diagnosticarFirebase = diagnosticarFirebase;
window.forzarGuardadoRespuestas = forzarGuardadoRespuestas;
window.forzarCreacionDocumento = forzarCreacionDocumento;

// Enviar formulario
if (quizForm) {
  quizForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!areAllQuestionsAnswered()) {
      showAlert("Aún faltan preguntas por responder. Por favor, completa todas.");
      return;
    }
    const scores = calculateScores();
    if (scores) {
      // Obtener email del usuario
      const emailInput = document.getElementById("user-email");
      const email = emailInput ? emailInput.value : "usuario@ejemplo.com";
      
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
      
      // Intentar guardar en Firebase, si falla usar respaldo local
      try {
        await actualizarRespuestasFirestore();
        await actualizarResultadoFirestore(resultado);
        console.log("Resultado guardado en Firebase");
      } catch (error) {
        console.error("Error guardando en Firebase, usando respaldo local:", error);
        guardarResultadoLocal(email, resultado, respuestasObj);
      }
      
      displayResults(scores);
    }
  });
} else {
  console.error("Elemento quizForm no encontrado.");
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