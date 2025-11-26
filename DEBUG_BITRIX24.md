# 🔧 Guía de Depuración - Integración con Bitrix24

## 📋 Resumen

Esta guía te ayudará a diagnosticar y solucionar problemas con la integración automática de Bitrix24 en el test DISC.

---

## 🚀 Cómo Funciona

Cuando el usuario completa el test y hace clic en "Ver resultados":

1. ✅ Se validan los datos (nombre, email, celular)
2. ✅ Se carga el formulario de Bitrix24 en segundo plano
3. ✅ Se rellenan automáticamente los campos
4. ✅ Se envía el formulario a Bitrix24
5. ✅ Se guarda en Firebase
6. ✅ Se muestran los resultados

---

## 🔍 Herramientas de Diagnóstico

### 1️⃣ Diagnóstico Completo de Bitrix24

Abre la **Consola del Navegador** (F12 o Cmd+Option+I) y ejecuta:

```javascript
diagnosticarBitrix24()
```

**Esto te mostrará:**
- ✅ Si el script de Bitrix24 está cargado
- ✅ Si existe el contenedor de Bitrix24
- ✅ Lista de todos los iframes en la página
- ✅ Iframes específicos de Bitrix24
- ✅ Variables globales de Bitrix24 (window.b24form, window.BX24)

**Ejemplo de salida:**
```
=== DIAGNÓSTICO DE BITRIX24 ===
1. Script de Bitrix24 cargado: ✅ SÍ
   - Src: https://cdn.bitrix24.es/b13143615/crm/form/loader_348.js?123456
2. Contenedor de Bitrix24: ✅ SÍ
   - Visible: hidden
3. Total de iframes en la página: 2
   - Iframe 1: https://b13143615.bitrix24.es/...
   - Iframe 2: about:blank
4. Iframes de Bitrix24 encontrados: 1
   - Bitrix Iframe 1: https://b13143615.bitrix24.es/...
...
```

---

### 2️⃣ Prueba Manual de Envío

Para probar el envío sin completar todo el test:

```javascript
probarEnvioBitrix24("Juan Pérez", "juan@ejemplo.com", "1234567890")
```

**Esto hará:**
- 🔄 Cargará el formulario de Bitrix24
- 🔍 Mostrará diagnóstico detallado
- 📝 Intentará rellenar los campos
- 📤 Intentará enviar el formulario
- ✅ Te dirá si fue exitoso

**Ejemplo de salida:**
```
=== PRUEBA DE ENVÍO A BITRIX24 ===
Datos a enviar: {nombre: "Juan Pérez", email: "juan@ejemplo.com", celular: "1234567890"}
Paso 1: Cargando formulario de Bitrix24...
✅ Formulario cargado
Paso 2: Esperando renderización completa...
...
Resultado: ✅ ÉXITO
=== FIN PRUEBA ===
```

---

### 3️⃣ Logs en Tiempo Real

Durante el uso normal del test, verás logs detallados en la consola:

#### Logs de Carga:
```
🔵 [BITRIX24 LOAD] Iniciando carga del formulario
📦 [BITRIX24 LOAD] Creando contenedor para el formulario...
✅ [BITRIX24 LOAD] Contenedor creado y agregado al DOM
📜 [BITRIX24 LOAD] Creando script de Bitrix24...
📡 [BITRIX24 LOAD] URL del script: https://...
✅ [BITRIX24 LOAD] Script de Bitrix24 cargado exitosamente
```

#### Logs de Llenado:
```
🔵 [BITRIX24] Iniciando llenado de formulario
📝 [BITRIX24] Datos a enviar: {nombre, email, celular}
🔍 [BITRIX24] Total de iframes encontrados: 2
✅ [BITRIX24] Iframe de Bitrix24 encontrado
📝 [BITRIX24] Rellenando campo nombre...
✅ [BITRIX24] Campo nombre rellenado
```

#### Tipos de iconos:
- 🔵 = Proceso en curso
- ✅ = Éxito
- ⚠️ = Advertencia
- ❌ = Error
- 🔍 = Búsqueda/Diagnóstico
- 📝 = Escritura de datos
- 📤 = Envío
- ⏳ = Esperando

---

## ❓ Problemas Comunes y Soluciones

### Problema 1: "No se encontraron iframes de Bitrix24"

**Causa:** El formulario de Bitrix24 aún no se ha cargado completamente.

**Solución:**
1. Espera 5-10 segundos
2. Ejecuta `diagnosticarBitrix24()` nuevamente
3. Si sigue sin aparecer, verifica que la URL del script sea correcta

**Código para verificar:**
```javascript
// Ver si el script se cargó
document.querySelector('script[data-b24-form="inline/348/em3lym"]')
```

---

### Problema 2: "No se pudo acceder al contenido del iframe (CORS)"

**Causa:** Bitrix24 usa un dominio diferente y tiene restricciones de seguridad.

**Explicación:** Esto es **NORMAL** y esperado. Los navegadores modernos bloquean el acceso entre dominios por seguridad.

**Solución automática implementada:**
- El código detecta este error
- Intenta usar `postMessage` como método alternativo
- O intenta buscar el formulario directamente en el DOM

**No requiere acción de tu parte.**

---

### Problema 3: "Botón de envío NO encontrado"

**Causa:** Los campos se rellenaron pero no se encontró el botón para hacer clic.

**Qué significa:** Los datos están listos pero no se envió automáticamente.

**Solución:**
1. Verifica que el formulario tenga un botón submit
2. Ejecuta para ver todos los botones:
```javascript
diagnosticarBitrix24()
// Busca la sección "Total de botones"
```

**Si necesitas ajustar el selector del botón:**
- Identifica el botón correcto en los logs
- Modifica la función `fillAndSubmitBitrix24Form`

---

### Problema 4: "Campos del formulario NO encontrados"

**Causa:** Los nombres de los campos en Bitrix24 son diferentes a los esperados.

**Solución:**
1. Ejecuta `diagnosticarBitrix24()`
2. Busca la sección "Total de inputs en el iframe"
3. Identifica los nombres reales de los campos
4. Actualiza los selectores en `fillAndSubmitBitrix24Form`

**Ejemplo de lo que verás:**
```
Total de inputs en el iframe: 4
  - Input 1: {type: "text", name: "NOMBRE_COMPLETO", placeholder: "Nombre"}
  - Input 2: {type: "email", name: "EMAIL_CONTACTO", placeholder: "Email"}
  - Input 3: {type: "tel", name: "TELEFONO", placeholder: "Teléfono"}
```

---

## ✅ Verificar que los Datos Llegaron a Bitrix24

### Método 1: Panel de Bitrix24

1. Inicia sesión en: https://b13143615.bitrix24.es/
2. Ve a **CRM** → **Formularios**
3. Busca el formulario **#348**
4. Revisa las **últimas entradas**
5. Verifica que los datos del test aparezcan

### Método 2: Ver en la Consola

Los logs te dirán si el formulario se envió:
```
✅ [BITRIX24] Formulario enviado exitosamente
```

---

## 🛠️ Solución de Problemas Avanzada

### Ver el HTML del Formulario

```javascript
// Ver contenido del contenedor de Bitrix24
const container = document.getElementById('bitrix-form-container');
console.log(container.innerHTML);
```

### Ver todos los iframes

```javascript
// Listar todos los iframes
document.querySelectorAll('iframe').forEach((iframe, i) => {
  console.log(`Iframe ${i + 1}:`, iframe.src);
});
```

### Acceder manualmente a un iframe

```javascript
// Reemplaza [0] con el índice del iframe de Bitrix24
const iframe = document.querySelectorAll('iframe')[0];
console.log('Contenido del iframe:', iframe.contentWindow.document);
```

### Forzar recarga del formulario

```javascript
// Eliminar contenedor existente
const container = document.getElementById('bitrix-form-container');
if (container) container.remove();

// Volver a cargar
loadBitrix24Form().then(() => {
  console.log('Formulario recargado');
  diagnosticarBitrix24();
});
```

---

## 📞 Contacto y Soporte

Si después de seguir esta guía sigues teniendo problemas:

1. **Copia todos los logs de la consola**
2. **Ejecuta `diagnosticarBitrix24()` y copia la salida**
3. **Toma capturas de pantalla de la consola**
4. **Contacta al equipo de desarrollo con esta información**

---

## 📝 Notas Técnicas

### URLs Importantes

- **Script de Bitrix24:** `https://cdn.bitrix24.es/b13143615/crm/form/loader_348.js`
- **Panel de Bitrix24:** `https://b13143615.bitrix24.es/`
- **Formulario ID:** `348`
- **Data attribute:** `inline/348/em3lym`

### Campos Requeridos

El formulario de Bitrix24 debe tener estos campos:
- ✅ **Nombre** (input type="text" o similar)
- ✅ **Email** (input type="email")
- ✅ **Celular** (input type="tel" o similar)

---

## 🎯 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] ¿El servidor web está corriendo? (`http://localhost:8000`)
- [ ] ¿La consola del navegador está abierta?
- [ ] ¿Ejecutaste `diagnosticarBitrix24()`?
- [ ] ¿Copiaste todos los logs relevantes?
- [ ] ¿Verificaste el panel de Bitrix24?
- [ ] ¿Probaste con `probarEnvioBitrix24()`?
- [ ] ¿Revisaste la conexión a internet?
- [ ] ¿El formulario de Bitrix24 está activo y accesible?

---

**Última actualización:** Noviembre 2025

