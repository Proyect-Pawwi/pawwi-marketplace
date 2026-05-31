export function verificationEmail(url: string) {
  return `
    <h1>Verifica tu cuenta</h1>

    <p>Haz clic en el siguiente enlace:</p>

    <a href="${url}">
      Verificar cuenta
    </a>
  `;
}