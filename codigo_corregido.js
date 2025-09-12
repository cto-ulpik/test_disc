// 2) Inicializar una sola vez
// const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

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
auth
  .signInAnonymously()
  .then(() => {
    // Autenticación exitosa
  })
  .catch((e) => {
    console.error("Error Auth:", e);
    paintStatus(
      "✖ Error de autenticación: " + (e.code || e.message),
      "#e53935"
    );
  });

// 4) Al cargar el DOM, probar lectura
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Esperar a que el usuario esté autenticado
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const uid = user.uid;
        // Si tus reglas SOLO permiten leer del propietario, usa una consulta filtrada:
        const q = db
          .collection("eneagrama")
          .where("user_id", "==", uid)
          .limit(1);
        await q.get();
        paintStatus("✔ Conectado a Firestore", "#388e3c");
        console.log("Conexión a Firestore exitosa");
      }
    });
  } catch (error) {
    console.error("Firestore test error:", error);
    if (
      error &&
      (error.code === "permission-denied" || error.code === "unauthenticated")
    ) {
      paintStatus(
        "⚠ Conectado, pero las reglas bloquearon la lectura (permission-denied).",
        "#f57c00"
      );
    } else {
      paintStatus(
        "✖ Error de conexión a Firestore: " + (error.code || error.message),
        "#e53935"
      );
    }
  }
});

// 5) Guardar resultado (incluye user_id para cumplir reglas)
let firestoreDocRef = null;
async function crearDocumentoFirestore(email) {
  const uid = auth.currentUser ? auth.currentUser.uid : null;
  const payload = {
    email,
    user_id: uid,
    consentimiento: true,
    fecha_creacion: firebase.firestore.FieldValue.serverTimestamp(),
    version_test: "v1.0",
    respuestas: {},
  };
  firestoreDocRef = await db.collection("eneagrama").add(payload);
}

async function actualizarRespuestasFirestore() {
  if (!firestoreDocRef) return;
  const respuestasObj = {};
  userResponses.forEach((resp, idx) => {
    if (resp !== null) {
      respuestasObj[`p${idx + 1}`] = resp.toString();
    }
  });
  await firestoreDocRef.update({ respuestas: respuestasObj });
}

async function actualizarResultadoFirestore(resultado) {
  if (!firestoreDocRef) return;
  await firestoreDocRef.update({ resultado });
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
  // return eliminado, no debe estar fuera de función
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
const restartTestBtn = wrapper.querySelector("#restart-test-btn"); // Corrección aquí
let resultsChart = null;

const numTypes = 9;

// --- PREGUNTAS (DEBES COMPLETARLAS CON 180) ---
// Array de objetos: { text: "Texto de la pregunta", type: (número del 1 al 9) }
// EJEMPLO CON POCAS PREGUNTAS - ¡RECUERDA PONER TUS 180 PREGUNTAS AQUÍ!
const allQuestionsData = [
  // Tipo 1 (Ejemplo: poner 20 preguntas por tipo para 180 totales)
  // 1 15 19 20 21 22 36 41 42 43 62 64 78 82 83 84 85 99 105 106 107
  //108 109 110 111 112 114 115 116  117  118 119 120 121 122 124  125
  { text: "Me esfuerzo por alcanzar la perfección en lo que hago.", type: 1 },
  { text: "Aprecio tener reglas que se espera que la gente siga.", type: 1 },
  {
    text: "Rara vez hay una buena razón para cambiar la forma en que se hacen las cosas.",
    type: 1,
  },
  { text: "Reviso cuidadosamente si hay errores y equivocaciones.", type: 1 },
  {
    text: "Paso tiempo intentando descubrir y corregir mis fallos y debilidades.",
    type: 1,
  },
  { text: "Tengo estándares muy altos para mí mismo", type: 1 },
  { text: "Me concentro en mis responsabilidades y deberes", type: 1 },
  { text: "Me presiono mucho para hacer las cosas bien.", type: 1 },
  { text: "Soy una persona responsable y confiable.", type: 1 },
  {
    text: "Todos tenemos un papel que desempeñar en la sociedad y el deber de hacer lo mejor que podamos.",
    type: 1,
  },
  {
    text: "La superación personal es uno de mis principales intereses.",
    type: 1,
  },
  {
    text: "¿A menudo me molesto porque las cosas no son como deberían ser?",
    type: 1,
  },
  { text: "¿No me gusta malgastar el tiempo?", type: 1 },
  {
    text: "¿Muchas veces me culpo a mi mismo por no hacer las cosas mejor?",
    type: 1,
  },
  { text: "¿Me cuesta relajarme y divertirme?", type: 1 },
  {
    text: "¿Pensamientos críticos de mi mismo y de otros, frecuentemente llenan mi cabeza ?",
    type: 1,
  },
  { text: "¿Me siento casi obligado a ser honesto?", type: 1 },
  { text: "¿Para mí es importante tener la razón?", type: 1 },
  { text: "¿Podría fácilmente ser, o soy una persona escrupulosa?", type: 1 },
  { text: "¿Me molesta de verdad algo que no sea justo?", type: 1 },

  // Tipo 2 (Ejemplo)
  //2 23 44 65 86 126 127 128 129 130 131 132 133 134 135 136 137 139 141 142 143 144 145
  { text: "Trabajo duro para ser útil a los demás.", type: 2 },
  {
    text: "Me gusta estar rodeado de personas a las que pueda ayudar.",
    type: 2,
  },
  {
    text: "Tomo la iniciativa para ayudar a otras personas y hacerles la vida más fácil.",
    type: 2,
  },
  { text: "Disfruto cuidando a los demás y sus necesidades.", type: 2 },
  { text: "¿Muchas personas dependen de mi ayuda y generosidad?", type: 2 },
  {
    text: "¿Me enorgullezco más de mi servicio a los demás que de ninguna otra cosa?",
    type: 2,
  },
  { text: "¿Necesito sentirme importante en la vida de los demás?", type: 2 },
  { text: "¿Muchas personas se sienten íntimas conmigo?", type: 2 },
  { text: "¿Regularmente halago a los demás ?", type: 2 },
  {
    text: "¿Me gusta rescatar a las personas, en dificultades o situaciones embarazosas?",
    type: 2,
  },
  {
    text: "¿Estoy casi impulsado a ayudar a otras personas, me guste o no?",
    type: 2,
  },
  {
    text: "¿Las personas frecuentemente se me acercan para recibir consejo o consuelo?",
    type: 2,
  },
  {
    text: "¿Muchas veces me siento sobrecargado por la dependencia de los demás en mi?",
    type: 2,
  },
  { text: "¿Pienso que no tengo muchas necesidades?", type: 2 },
  {
    text: "¿ A veces siento que los demás no me aprecian verdaderamente, a pesar de todo lo que hago por ellos?",
    type: 2,
  },
  { text: "¿Me gusta sentirme en intimidad con los demás?", type: 2 },
  {
    text: "¿Siento que debo ser la persona más importante en la vida de alguien debido a lo que he hecho por él?",
    type: 2,
  },
  {
    text: "¿Pienso que soy una persona que fomenta el crecimiento de los demás?",
    type: 2,
  },
  {
    text: "¿Cuándo tengo tiempo libre, frecuentemente lo paso ayudando a otros?",
    type: 2,
  },
  {
    text: "¿Me comunico con mis amigos más de lo que ellos se comunican conmigo?",
    type: 2,
  },
  // ... (continuar hasta 20 por tipo)

  // Tipo 3 ... (20 preguntas)
  //3 4 24 25 26 45 46 63 66 67 68 87 88 89 147  149 150 151 152 153 154 156 157 158  159 160 161 162 163 164 165
  { text: "Es importante para mí que le guste a otras personas.", type: 3 },
  { text: "Es importante para mí lograr grandes cosas.", type: 3 },
  {
    text: "¿Siento que necesito muchos logros antes que otras personas me tomen en cuenta?",
    type: 3,
  },
  { text: "¿Haría bien el trabajo de promocionar un proyecto?", type: 3 },
  {
    text: "Las organizaciones a las que pertenezco no funcionarían bien sin mí.",
    type: 3,
  },
  {
    text: "¿Tiendo a ser una persona asertiva (afirmar mi persona) y emprendedora?",
    type: 3,
  },
  { text: "Quiero lograr mucho en mi vida.", type: 3 },
  {
    text: "Leo libros que me ayudan a ser más productivo o mejor en lo que hago.",
    type: 3,
  },
  { text: "¿Creo que las apariencias son importantes?", type: 3 },
  { text: "Me fijé metas ambiciosas", type: 3 },
  {
    text: "¿Me choca que me digan que algo que estoy haciendo no sirve?",
    type: 3,
  },
  {
    text: "¿Generalmente prefiero involucrarme en el aspecto de la iniciativa de una operación, en vez de la continuación de la misma ?",
    type: 3,
  },
  {
    text: "¿La capacidad de organizar las cosas y realizarlas parece ser algo natural para mí?",
    type: 3,
  },
  { text: "¿Éxito es una palabra que significa mucho para mí ?", type: 3 },
  {
    text: "¿Me gusta tener metas claras y saber en que punto del camino hacia ellas me encuentro?",
    type: 3,
  },
  {
    text: "¿Me gustan los diagramas de progreso, las notas y otras evaluaciones de cómo voy?",
    type: 3,
  },
  { text: "¿Las otras personas envidian mucho lo que hago?", type: 3 },
  {
    text: "¿Mostrar una imagen de triunfador es muy importante para mí ?",
    type: 3,
  },
  {
    text: "¿Para tener éxito a veces tienes que olvidarte un poco de tus principios?",
    type: 3,
  },
  {
    text: "¿Al recordar mi pasado, tiendo a acordarme de lo que hice bien y correcto, en vez de lo que hice mal e incorrecto?",
    type: 3,
  },
  // Tipo 4 ... (20 preguntas)
  //5 6 7 18 27 28 34 39 48 49 60 69 70 81 91 166 167 168 169 170 171 172
  //173 174 175 176 177 178 179 180 181 183 184 185
  {
    text: "Hago contribuciones más significativas que la persona promedio.",
    type: 4,
  },
  { text: "Siento mis emociones muy profundamente.", type: 4 },
  {
    text: "Tengo la sensación de que otras personas nunca me entenderán verdaderamente",
    type: 4,
  },
  { text: "No encajo con la gente común.", type: 4 },
  { text: "¿Me gusta hacer las cosas bien y con clase ?", type: 4 },
  { text: "Siempre me he sentido diferente a las demás personas.", type: 4 },
  {
    text: "No dudo en llamar la atención a las personas cuando se portan mal.",
    type: 4,
  },
  {
    text: "¿Me gusta mucho el teatro y en mis fantasías me imagino que estoy en el escenario?",
    type: 4,
  },
  {
    text: "Siento un profundo sentimiento de dolor por lo que he perdido.",
    type: 4,
  },
  {
    text: "¿A veces temo que la manifestación de mis sentimientos no es suficiente?",
    type: 4,
  },
  { text: "¿El ambiente que me rodea es muy importante para mí?", type: 4 },
  {
    text: "Puedo describir mis emociones con mucha profundidad y detalle.",
    type: 4,
  },
  { text: "A menudo me siento como un extraño", type: 4 },
  {
    text: "Tengo intereses diferentes a los de la mayoría de la gente.",
    type: 4,
  },
  {
    text: "¿Parezco absorber fácilmente los sentimientos de un grupo, tanto así que frecuentemente no puedo diferenciar cuales son mis sentimientos y cuales los del grupo ?",
    type: 4,
  },
  {
    text: "¿La mayoría de las personas no aprecian la verdadera belleza de la vida?",
    type: 4,
  },
  { text: "¿Siento una nostalgia casi compulsiva por mi pasado?", type: 4 },
  { text: "¿Trato de parecer sencillo y natural?", type: 4 },
  {
    text: "Me encuentro oscilando entre altos y bajos. Estoy o eufórico o deprimido. No me siento con vida cuando estoy en equilibrio?",
    type: 4,
  },
  {
    text: "¿El arte y expresión artística son muy importantes para mí, como una forma de canalizar mis emociones?",
    type: 4,
  },

  // Tipo 5 ... (20 preguntas)
  //8 29 50 71 90 92 186 187 188 189 190 191 193 194 195 196 197 199 200 201 202
  { text: "Pienso profundamente en las cosas", type: 5 },
  { text: "Me gusta analizar las cosas desde todos los ángulos.", type: 5 },
  {
    text: "Me tomo tiempo para comprender las cosas más profundamente que la mayoría de la gente.",
    type: 5,
  },
  { text: "Encuentro que mi mente es un lugar muy interesante.", type: 5 },
  { text: "Rara vez tengo emociones fuertes.", type: 5 },
  {
    text: "Quiero aprender todo lo que pueda sobre cómo funciona el mundo.",
    type: 5,
  },
  { text: "¿Tiendo a no revelar mis sentimientos?", type: 5 },
  {
    text: "¿Guardo lo que tengo y recojo cosas que pueda necesitar algún día?",
    type: 5,
  },
  { text: "¿No sé cómo llevar una conversación ligera?", type: 5 },
  {
    text: "¿Intelectualmente me gusta sintetizar y reunir ideas diferentes?",
    type: 5,
  },
  {
    text: "¿Se me pone la mente en blanco cuando me siento avergonzado o cuando alguien me pregunta como me siento?",
    type: 5,
  },
  { text: "¿Necesito mucha privacidad, tiempo y espacio propio?", type: 5 },
  {
    text: "¿Muchas veces me encuentro como observador en vez de involucrarme?",
    type: 5,
  },
  { text: "¿Tiendo a ser un poco solitario?", type: 5 },
  { text: "¿Aparento ser más callado que la mayoría?", type: 5 },
  { text: "¿Me cuesta tender la mano o pedir algo que necesito?", type: 5 },
  {
    text: "¿Si surge un problema, me gusta resolverlo primero yo solo y luego discutirlo con los demás ?",
    type: 5,
  },
  {
    text: "¿Me choca cuando hago una mala compra (cuando no recibo el valor de mi dinero) ?",
    type: 5,
  },
  {
    text: "¿Me gusta poner las cosas en perspectiva para luego asimilarlas. Si se me escapa alguna cosa me culpo de ser simplista o ingenuo?",
    type: 5,
  },
  {
    text: "¿Tiendo a ser tacaño con mi tiempo, mi dinero y mi personal?",
    type: 5,
  },
  // Tipo 6 ... (20 preguntas)
  //9 16 17 30 37 38 51 57 58 59 72 79 80 93 100 101
  //113 207 208 209 210 211 212 213 214 215 216 217
  //218 219 220 221 222 223 224 225
  { text: "Estoy preparado para cualquier desastre.", type: 6 },
  { text: "Me preocupa la seguridad más que cualquier otra cosa.", type: 6 },
  { text: "Pienso mucho en lo que pasará en el futuro.", type: 6 },
  {
    text: "Siempre tengo un plan de lo que haría si las cosas salen mal.",
    type: 6,
  },
  {
    text: "Busco relaciones que me ofrezcan algún tipo de protección.",
    type: 6,
  },
  {
    text: "Puedo visualizar claramente lo que podría pasar en el futuro.",
    type: 6,
  },
  {
    text: "¿Muchas veces me pregunto si tendré el coraje para hacer algo que debo hacer?",
    type: 6,
  },
  {
    text: "Me siento más cómodo en organizaciones con una jerarquía clara.",
    type: 6,
  },
  {
    text: "Tomo medidas para protegerme a mí mismo y a mis seres queridos de cualquier daño.",
    type: 6,
  },
  { text: "¿Muchas veces me encuentro lleno de dudas?", type: 6 },
  {
    text: "¿Tiendo a actuar debido a un sentido del deber y responsabilidad?",
    type: 6,
  },
  {
    text: "Hago alianzas con personas que pueden ayudarme a mantenerme seguro y protegido.",
    type: 6,
  },
  {
    text: "¿Prefiero tener las cosas sujetas a un horario en vez de cuando sea ?",
    type: 6,
  },
  {
    text: "Es importante para mí entender qué puede salir mal en una situación.",
    type: 6,
  },
  { text: "Me preocupa proteger lo que tengo", type: 6 },
  {
    text: "¿Parece preocuparme más que a otras personas el defenderme a mí mismo y mi posición?",
    type: 6,
  },
  { text: "¿Parezco preocuparme más que otras personas?", type: 6 },
  { text: "¿La lealtad a un grupo es muy importante para mí?", type: 6 },
  {
    text: "¿Me cuesta mucho ir en contra de lo que dice la autoridad?",
    type: 6,
  },
  {
    text: "¿Antes de tomar una decisión, busco información adicional para asegurarme que estoy preparado?",
    type: 6,
  },
  // Tipo 7 ... (20 preguntas)
  //10 11 12 32 33 52 53 54 73 74 75 94 95 96 103 227
  //228 229 230 231 232 233 234 235 237 238 239 240 241 242 243 244 245
  {
    text: "Para mí es importante evitar el dolor y el sufrimiento en todo momento.",
    type: 7,
  },
  {
    text: "Busco experiencias que sé que me harán sentir feliz o emocionado.",
    type: 7,
  },
  { text: "Veo lo positivo en cada situación.", type: 7 },
  { text: "¿Me caen bien casi todas las personas que conozco?", type: 7 },
  {
    text: "Soy bueno viendo el lado positivo de las cosas cuando otros se quejan.",
    type: 7,
  },
  {
    text: "Me distraigo de cualquier sentimiento triste que surja.",
    type: 7,
  },
  {
    text: "A menudo hago cambios en mi vida cuando las cosas se vuelven aburridas.",
    type: 7,
  },
  { text: "Tiendo a ser más optimista que la mayoría de la gente.", type: 7 },
  {
    text: "Tengo muchas formas de evitar situaciones que me deprimen.",
    type: 7,
  },
  {
    text: "¿Me gusta contar cuentos, chistes, anécdotas graciosas?",
    type: 7,
  },
  { text: "¿Mi teoría es Si algo es bueno, más es mejor?", type: 7 },
  {
    text: "Tomo medidas para asegurarme de no sentirme triste o solo.",
    type: 7,
  },
  { text: "Probar cosas nuevas hace que la vida sea interesante", type: 7 },
  { text: "Soy una persona optimista", type: 7 },
  {
    text: "Pruebo nuevas formas de hacer las cosas sólo para ver si funcionan.",
    type: 7,
  },
  {
    text: "¿Hay muy pocas cosas en la vida de las cuales no puedo disfrutar?",
    type: 7,
  },
  {
    text: "¿No pienso que sea bueno estar triste por mucho tiempo?",
    type: 7,
  },
  {
    text: "¿Me gustaría que los demás tomaran las cosas menos en serio?",
    type: 7,
  },
  { text: "¿Me gusta ser considerado una persona alegre?", type: 7 },
  { text: "¿Recuerdo a mi niñez como un tiempo feliz ?", type: 7 },
  // Tipo 8 ... (20 preguntas)
  //13 55 76 97 104 246 247 248 249 250 251 252 253 254  256 257 259 260 261 262
  {
    text: "No tengo miedo de decirle a alguien cuando creo que está equivocado.",
    type: 8,
  },
  {
    text: "Le digo a la gente lo que pienso, aunque sea difícil escucharlo.",
    type: 8,
  },
  {
    text: "Defiendo lo que creo, incluso si eso molesta a otras personas.",
    type: 8,
  },
  {
    text: "Generalmente soy yo quien toma una posición cuando otros no lo hacen.",
    type: 8,
  },
  { text: "Tengo mucha fuerza de voluntad.", type: 8 },
  {
    text: "¿Soy muy bueno defendiendo y peleando por lo que deseo?",
    type: 8,
  },
  {
    text: "¿Me doy cuenta rápidamente del punto débil de los demás y los toco en el cuando me provocan?",
    type: 8,
  },
  { text: "¿Me es fácil expresar mi descontento con las cosas?", type: 8 },
  { text: "¿No temo confrontar a las personas y lo hago?", type: 8 },
  { text: "¿Gozo ejerciendo autoridad, poder?", type: 8 },
  {
    text: "¿Tengo un sexto sentido de donde reside el poder de un grupo?",
    type: 8,
  },
  { text: "¿Soy una persona agresiva, dogmática y auto asertiva?", type: 8 },
  { text: "¿Sé como hacer que se hagan las cosas?", type: 8 },
  {
    text: "¿Me cuesta aceptar y expresar mi lado tierno, gentil, suave, femenino?",
    type: 8,
  },
  { text: "¿La justicia e injusticia son puntos claves para mí?", type: 8 },
  {
    text: "¿Protejo a las personas que están bajo mi autoridad o jurisdicción?",
    type: 8,
  },
  {
    text: "¿Generalmente, no me atrae mucho la introspección o demasiado auto análisis?",
    type: 8,
  },
  { text: "¿Me considero una persona no conformista?", type: 8 },
  { text: "¿No me gusta que me acorralen?", type: 8 },
  { text: "¿No me gusta que me digan que debo adaptarme?", type: 8 },

  // Tipo 9 ... (20 preguntas)
  //14 35 40 56 61 77 98 102 204 205 206 226 263 265
  //266 267 268 269 270 271 272 273 274 275 276 277 278 279 280 281 282 283 284 285
  { text: "Dejo que otras personas tomen las decisiones", type: 9 },
  { text: "Estoy de acuerdo con lo que quieren los demás", type: 9 },
  { text: "Me gusta hacer las cosas como siempre las he hecho.", type: 9 },
  {
    text: "Prefiero seguir al grupo que esforzarme por conseguir lo que quiero.",
    type: 9,
  },
  { text: "No me gusta probar nuevos métodos o procedimientos.", type: 9 },
  { text: "Dejo que otras personas tomen la iniciativa", type: 9 },
  { text: "Otras personas tienen opiniones más fuertes que yo.", type: 9 },
  {
    text: "Soy una persona promedio con gustos y disgustos comunes.",
    type: 9,
  },
  {
    text: "¿Tengo un tono de voz suave y las personas a menudo me tienen que pedir que hable más alto?",
    type: 9,
  },
  { text: "¿Tiendo a ser más una persona que recibe a una que dá?", type: 9 },
  { text: "¿Básicamente, soy una persona común y corriente?", type: 9 },
  {
    text: "¿Parezco sospechar menos de las personas y sus motivos que los demás?",
    type: 9,
  },
  { text: "¿Me considero un buen trabajador?", type: 9 },
  { text: "¿Pienso que los demás se crean sus propios problemas?", type: 9 },
  {
    text: "¿La mayoría de las personas se agitan demasiado con las cosas?",
    type: 9,
  },
  {
    text: "¿La mayoría de las cosas en la vida, no merecen que uno se inquiete?",
    type: 9,
  },
  { text: "¿Casi siempre estoy tranquilo y calmado?", type: 9 },
  { text: "¿Me gusta tener tiempo para no hacer nada?", type: 9 },
  { text: "¿Soy una persona sumamente serena?", type: 9 },
  {
    text: "¿No me acuerdo cuando fue la última vez que tuve problemas para dormir?",
    type: 9,
  },
];
// Asegúrate de tener 20 preguntas por cada uno de los 9 tipos (total 180)

const typeColors = [
  "#FFC3A0",
  "#FF6B6B",
  "#D2691E",
  "#6A0DAD",
  "#C3B1E1",
  "#5F9EA0",
  "#ADD8E6",
  "#90EE90",
  "#FFB6C1",
];
const typeLabels = Array.from({ length: numTypes }, (_, i) => `Tipo ${i + 1}`);
const grayColor = "#CCCCCC";

let currentPage = 1;
const questionsPerPage = 20; // O 20 si prefieres menos páginas con 180 preguntas
let shuffledQuestions = [];
let userResponses = [];

const prevBtn = document.createElement("button");
prevBtn.type = "button";
prevBtn.id = "prev-btn";
prevBtn.textContent = "Anterior";
const nextBtn = document.createElement("button");
nextBtn.type = "button";
nextBtn.id = "next-btn";
nextBtn.textContent = "Siguiente";

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function initializeQuiz() {
  console.log("Inicializando quiz..."); // Depuración
  if (!quizContainer || !submitBtn || !paginationControlsDiv || !quizForm) {
    console.error("Faltan elementos esenciales del quiz en el DOM.");
    return;
  }

  // Inicializar preguntas y respuestas
  shuffledQuestions = [...allQuestionsData];
  shuffleArray(shuffledQuestions);
  userResponses = Array(shuffledQuestions.length).fill(null);

  // Mostrar el formulario y ocultar el botón de inicio
  if (quizForm && startTestContainer) {
    quizForm.style.display = "block";
    startTestContainer.style.display = "none";
  }

  // Configurar controles de paginación
  if (paginationControlsDiv) {
    paginationControlsDiv.innerHTML = "";
    const pagBtnsWrapper = document.createElement("div");
    pagBtnsWrapper.style.display = "flex";
    pagBtnsWrapper.style.justifyContent = "space-between";
    pagBtnsWrapper.style.alignItems = "center";
    pagBtnsWrapper.style.gap = "10px";
    pagBtnsWrapper.appendChild(prevBtn);
    pagBtnsWrapper.appendChild(nextBtn);
    paginationControlsDiv.appendChild(pagBtnsWrapper);
    paginationControlsDiv.style.display = "block";
  }

  // Configurar botones de navegación
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
    await actualizarRespuestasFirestore();

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

  // Renderizar primera página y actualizar botones
  renderCurrentPage();
  updatePaginationButtons();
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
  if (!prevBtn || !nextBtn || !submitBtn) return;

  const totalPages = Math.ceil(shuffledQuestions.length / questionsPerPage);
  prevBtn.disabled = currentPage === 1;

  // Mostrar u ocultar el botón “Siguiente”
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
      const questionDiv = wrapper.querySelector(`#question-global-${i}`);
      if (questionDiv) {
        questionDiv.style.borderColor = "red";
        questionDiv.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
  }
  return true;
}

function updateSubmitButtonVisibility() {
  if (!submitBtn) return;

  const allAnswered = userResponses.every((response) => response !== null);
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
  for (let i = 0; i < userResponses.length; i++) {
    if (userResponses[i] === null) {
      const pageOfMissingQuestion = Math.floor(i / questionsPerPage) + 1;
      currentPage = pageOfMissingQuestion;
      renderCurrentPage();
      updatePaginationButtons();
      setTimeout(() => {
        const missingQuestionDiv = wrapper.querySelector(
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
  hideAlert();

  const scores = Array(numTypes).fill(0);
  userResponses.forEach((responseValue, globalIndex) => {
    if (
      shuffledQuestions[globalIndex] &&
      typeof shuffledQuestions[globalIndex].type !== "undefined"
    ) {
      const originalType = shuffledQuestions[globalIndex].type;
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

  const loadingSpinner = wrapper.querySelector("#loading-spinner");
  loadingSpinner.style.display = "block";
  resultsContainer.style.display = "none";

  setTimeout(() => {
    loadingSpinner.style.display = "none";
    resultsContainer.style.display = "block";

    const maxScore = Math.max(...scores);
    const dominantTypeIndex = scores.indexOf(maxScore);
    const dominantType = dominantTypeIndex + 1;

    resultsTextDiv.innerHTML = `<p class="dominant-type">Tu tipo de personalidad según el Eneagrama es: <strong>Tipo ${dominantType}</strong></p>`;

    drawChart(scores, dominantTypeIndex);

    paginationControlsDiv.style.display = "none";
    submitBtn.style.display = "none";
    quizForm.style.display = "none";

    if (typeDescriptions && typeDescriptions.length > 0) {
      typeDescriptions.forEach((desc) => (desc.style.display = "none"));

      const dominantTypeDesc = wrapper.querySelector(`#type-${dominantType}`);
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
  const chartCanvas = wrapper.querySelector("#results-chart");
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

  // Configuración del gráfico circular (PolarArea)
  resultsChart = new Chart(chartCtx, {
    type: "polarArea", // Tipo de gráfico circular
    data: {
      labels: typeLabels,
      datasets: [
        {
          label: "Resultado",
          data: scores,
          backgroundColor: backgroundColors,
          borderColor: "#FFFFFF",
          borderWidth: 1,
          borderAlign: "center", // Alinea los bordes al centro para evitar sobreposiciones
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: maxScorePerType > 0 ? maxScorePerType : 100,
          pointLabels: {
            display: true,
            centerPointLabels: true,
            font: { size: 14, weight: "bold" },
          },
          ticks: {
            display: false, // Oculta las marcas de escala para un aspecto más limpio
          },
          grid: {
            circular: true, // Asegura que la cuadrícula sea circular
          },
        },
      },
      plugins: {
        legend: {
          display: false, // Ocultar la leyenda ya que solo mostramos el tipo dominante
        },
        tooltip: {
          enabled: false, // Desactivar tooltips para no mostrar puntajes
        },
      },
      layout: {
        padding: 20, // Añade espacio alrededor del gráfico
      },
      elements: {
        arc: {
          borderWidth: 1,
          borderColor: "#FFFFFF",
        },
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
    // Crear documento en Firestore al iniciar el test
    await crearDocumentoFirestore(emailInput.value);
    initializeQuiz();
  });
} else {
  console.warn(
    "Botón 'start-test-btn' no encontrado. El test no se iniciará automáticamente."
  );
}

// Enviar formulario
if (quizForm) {
  quizForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!areCurrentPageQuestionsAnswered()) return;
    const scores = calculateScores();
    if (scores) {
      // Guardar respuestas finales y resultado en Firestore
      await actualizarRespuestasFirestore();
      // Modelo resultado: { tipo, puntaje, descripcion }
      const maxScore = Math.max(...scores);
      const dominantTypeIndex = scores.indexOf(maxScore);
      const resultado = {
        tipo: (dominantTypeIndex + 1).toString(),
        puntaje: maxScore,
        descripcion: obtenerDescripcionTipo(dominantTypeIndex + 1),
      };
      await actualizarResultadoFirestore(resultado);
      displayResults(scores);
    }
  });
} else {
  console.error("Elemento quizForm no encontrado.");
}

// Devuelve la descripción del tipo (puedes personalizar)
function obtenerDescripcionTipo(tipo) {
  const descripciones = {
    1: "El perfeccionista",
    2: "El ayudador",
    3: "El triunfador",
    4: "El individualista",
    5: "El investigador",
    6: "El leal",
    7: "El entusiasta",
    8: "El desafiador",
    9: "El pacificador",
  };
  return descripciones[tipo] || "";
}
