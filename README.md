# Test DISC - Evaluación de Comportamiento

## 📋 Descripción del Proyecto

**Test DISC** es una aplicación web moderna y responsiva que permite a los usuarios realizar una evaluación completa de su estilo de comportamiento basada en el modelo DISC. El test evalúa cuatro dimensiones principales del comportamiento humano y proporciona resultados detallados con visualizaciones interactivas.

### 🎯 ¿Qué es el Test DISC?

El modelo DISC es una herramienta de evaluación del comportamiento que clasifica los estilos de personalidad en cuatro dimensiones:

- **🔴 Dominancia (D)**: Directo, decidido, orientado a resultados y competitivo
- **🟡 Influencia (I)**: Sociable, persuasivo, optimista y entusiasta  
- **🟢 Estabilidad (S)**: Paciente, confiable, cooperativo y calmado
- **🔵 Cumplimiento (C)**: Analítico, meticuloso, preciso y orientado a normas

## 🚀 Características Principales

### ✨ Funcionalidades del Test
- **40 preguntas cuidadosamente seleccionadas** (10 por cada estilo DISC)
- **Interfaz intuitiva** con navegación fluida entre preguntas
- **Resultados visuales** con gráficos interactivos usando Chart.js
- **Descripciones detalladas** de cada estilo de comportamiento
- **Sistema de puntuación** automático y análisis de resultados

### 🎨 Experiencia de Usuario
- **Diseño responsivo** que se adapta a dispositivos móviles y desktop
- **Animaciones suaves** y transiciones elegantes
- **Colores distintivos** para cada tipo DISC
- **Loaders personalizados** para mejorar la experiencia
- **Notificaciones toast** para feedback inmediato

### 📱 Sección de Contacto WhatsApp
- **Formulario integrado** para recopilar números de WhatsApp
- **Validación automática** de números telefónicos
- **Códigos de país** con Ecuador como predeterminado
- **Limpieza automática** de números (elimina 0 inicial)
- **Prevención de envíos múltiples**

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5** - Estructura semántica y accesible
- **CSS3** - Estilos modernos con gradientes, animaciones y diseño responsivo
- **JavaScript (ES6+)** - Lógica de la aplicación y manipulación del DOM
- **Chart.js** - Visualización de resultados con gráficos interactivos
- **Toastify** - Notificaciones elegantes y no intrusivas

### Backend y Base de Datos
- **Firebase Firestore** - Base de datos NoSQL en tiempo real
- **Firebase Authentication** - Autenticación anónima para usuarios
- **Firebase Hosting** - Almacenamiento y distribución de archivos estáticos

### Herramientas de Desarrollo
- **Git** - Control de versiones
- **Responsive Design** - Diseño adaptable a múltiples dispositivos
- **Progressive Web App (PWA)** - Características de aplicación web moderna

## 📊 Estructura de Datos

### Colección Firestore: `disc`
```javascript
{
  email: "usuario@ejemplo.com",
  answers: [1, 2, 3, 4, ...], // Array de 40 respuestas
  scores: [15, 12, 8, 5], // Puntuaciones por tipo DISC
  dominantType: 1, // Tipo dominante (1-4)
  timestamp: "2024-01-15T10:30:00Z",
  num_whats: "+593987654321", // Número de WhatsApp (opcional)
  whatsapp_timestamp: "2024-01-15T10:35:00Z" // Timestamp de WhatsApp
}
```

## 🎨 Paleta de Colores DISC

- **Dominancia**: `#FF595E` (Rojo)
- **Influencia**: `#FFCA3A` (Amarillo)  
- **Estabilidad**: `#22C55E` (Verde)
- **Cumplimiento**: `#1982C4` (Azul)

## 📁 Estructura del Proyecto

```
test_disc/
├── index.html              # Página principal
├── styles.css              # Estilos CSS
├── codigo_corregido.js     # Lógica JavaScript principal
├── media/
│   └── negro_ul.svg        # Logo de Ulpik
├── firestore-rules.txt     # Reglas de seguridad Firestore
└── README.md              # Documentación del proyecto
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- Conexión a Internet
- Cuenta de Firebase (para configuración de base de datos)

### Configuración de Firebase
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Firestore Database
3. Configurar reglas de seguridad (ver `firestore-rules.txt`)
4. Obtener configuración del proyecto
5. Actualizar configuración en `codigo_corregido.js`

### Despliegue
```bash
# Clonar repositorio
git clone [url-del-repositorio]
cd test_disc

# Configurar Firebase
firebase init
firebase deploy
```

## 📱 Uso de la Aplicación

### Para Usuarios
1. **Acceso**: Abrir la aplicación en cualquier navegador
2. **Registro**: Ingresar email y aceptar términos de uso
3. **Test**: Responder las 40 preguntas del cuestionario
4. **Resultados**: Visualizar el análisis completo del comportamiento
5. **Contacto**: Opcionalmente, proporcionar número de WhatsApp

### Para Desarrolladores
- **Modo Debug**: Abrir consola del navegador para logs detallados
- **Validación**: Sistema de validación en tiempo real
- **Responsive**: Pruebas en múltiples dispositivos recomendadas

## 🔒 Seguridad y Privacidad

- **Autenticación anónima** para proteger la privacidad
- **Validación de entrada** en frontend y backend
- **Reglas de seguridad** configuradas en Firestore
- **Datos encriptados** en tránsito y reposo
- **Cumplimiento** con mejores prácticas de seguridad web

## 📈 Métricas y Analytics

- **Tiempo de respuesta** por pregunta
- **Tasa de finalización** del test
- **Distribución** de tipos DISC
- **Engagement** con sección de WhatsApp
- **Rendimiento** de la aplicación

## 🤝 Contribución

Para contribuir al proyecto:
1. Fork del repositorio
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o consultas:
- **Email**: [email de contacto]
- **WhatsApp**: [número de contacto]
- **Issues**: [enlace al repositorio de issues]

---

**Desarrollado por Ulpik** 🚀
