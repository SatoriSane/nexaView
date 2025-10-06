# 🎨 Iconos PWA

Esta carpeta debe contener los iconos de la Progressive Web App.

## 📋 Iconos Requeridos

- `icon-128x128.png` - Icono de 128x128 píxeles
- `icon-512x512.png` - Icono de 512x512 píxeles

## 🔧 Cómo Generar los Iconos

### Opción 1: Generador HTML (Recomendado)
1. Abre `generate-icons.html` en tu navegador
2. Descarga ambos iconos
3. Colócalos en esta carpeta

### Opción 2: Generador Online
1. Ve a [favicon.io](https://favicon.io/favicon-generator/)
2. Configura:
   - Texto: "NB" o "Nexa"
   - Fondo: `#6366f1`
   - Texto: `#ffffff`
3. Descarga y renombra a `icon-128x128.png` y `icon-512x512.png`

### Opción 3: Diseño Personalizado
Crea tus propios iconos con estas especificaciones:
- Formato: PNG
- Tamaños: 128x128 y 512x512 píxeles
- Fondo: Gradiente azul (`#6366f1` → `#4f46e5`)
- Diseño: Símbolo relacionado con blockchain/Nexa

## ⚠️ Importante

Los iconos son **obligatorios** para que la PWA funcione correctamente. Sin ellos:
- La app no se instalará como PWA
- No aparecerá el icono en la pantalla de inicio
- Vercel mostrará errores 404 para los iconos

## 🧪 Iconos Temporales

Si necesitas iconos temporales rápidamente:

```bash
# Generar SVG placeholders
node ../create-placeholder-icons.js

# Luego convierte los SVG a PNG usando:
# - Un conversor online: https://cloudconvert.com/svg-to-png
# - ImageMagick: convert icon-128x128.svg icon-128x128.png
```

## ✅ Verificar

Después de agregar los iconos, verifica que:
1. Los archivos existan en esta carpeta
2. Los nombres sean exactamente `icon-128x128.png` y `icon-512x512.png`
3. Los tamaños sean correctos (128x128 y 512x512 píxeles)
4. El formato sea PNG

Puedes verificar en el navegador:
- DevTools → Application → Manifest
- Deberías ver los iconos listados sin errores
