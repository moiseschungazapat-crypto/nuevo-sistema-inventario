# Acceso en dos pasos por correo

El login ahora usa este flujo:

1. Se verifica correo y contraseña con `signInWithPassword`.
2. La sesión provisional se cierra inmediatamente.
3. `signInWithOtp` envía el código de seis dígitos al mismo correo, sin crear cuentas nuevas.
4. `verifyOtp` valida el código y crea la sesión definitiva.
5. La aplicación vuelve a comprobar el perfil y el rol antes de abrir el dashboard.

Esto reutiliza el proveedor SMTP y la plantilla de Auth mostrados en tus capturas. La plantilla de correo debe mostrar `{{ .Token }}` para enseñar el código de seis dígitos. Si usa `{{ .ConfirmationURL }}`, llegará un enlace en lugar del código.

## Configuración en Supabase

- Authentication → Sign In / Providers → Email: habilitar email/password y OTP; desactivar el registro público si la aplicación es interna.
- Authentication → Emails → SMTP: conservar el proveedor verificado y configurar el remitente de la empresa.
- Authentication → Emails → Templates → Magic link or OTP: incluir `{{ .Token }}` en el diseño del código.
- Authentication → Rate Limits: mantener al menos 60 segundos entre códigos por usuario y los límites de intentos del proyecto.
- Authentication → URL Configuration: definir el dominio de producción de Vercel y no usar comodines.

## Comprobación

En una ventana privada:

- Contraseña incorrecta: no debe enviarse OTP.
- Contraseña correcta: debe mostrar la segunda pantalla y llegar un correo.
- Código incorrecto, incompleto o vencido: no debe abrir el dashboard.
- Reenviar: queda bloqueado durante 60 segundos.
- Volver: borra el código anterior y exige nuevamente la contraseña.
- Código correcto con perfil inactivo: Supabase autentica, pero la aplicación cierra la sesión y rechaza el acceso.

El código de seis dígitos no se genera ni se almacena en JavaScript. El cliente solo transmite el token que el usuario recibió por correo; Supabase Auth lo genera, caduca y valida. Este mecanismo es un segundo paso por correo. Para mayor resistencia ante compromiso del correo, Supabase recomienda MFA con una aplicación autenticadora TOTP; puede añadirse más adelante para administradores.
