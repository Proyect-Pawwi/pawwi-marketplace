export function resetPasswordEmail(
  url: string
) {
  return `
    <h1>Recuperar contraseña</h1>

    <p>Haz clic aquí:</p>

    <a href="${url}">
      Restablecer contraseña
    </a>
  `;
}