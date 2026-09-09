import type { AuthError } from "@supabase/supabase-js";

/**
 * Erro do Supabase Auth → frase que a pessoa entende, em português.
 *
 * Por que existe: o supabase-js devolve a mensagem do servidor em inglês
 * ("Invalid login credentials", "For security purposes, you can only request
 * this after 51 seconds"), e cada tela vinha decidindo sozinha o que fazer com
 * ela. O login traduzia um caso e repassava o resto cru; o cadastro repassava
 * tudo cru. Num produto em português, isso é a interface trocando de idioma no
 * pior momento possível — quando algo deu errado.
 *
 * A leitura é por `code` primeiro (estável entre versões) e pela mensagem só
 * como reserva, porque instalações mais antigas do GoTrue não mandam código.
 *
 * O fallback NÃO repete a mensagem original: se ela não está mapeada aqui, é
 * texto técnico em inglês, e mostrá-lo não ajuda ninguém a resolver nada.
 */
export function authErrorMessage(
  error: Pick<AuthError, "message" | "code"> | null | undefined,
  fallback = "Não foi possível concluir agora. Tente novamente em instantes."
): string {
  if (!error) return fallback;

  const code = error.code ?? "";
  const message = error.message ?? "";

  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Este e-mail já possui uma conta. Entre ou redefina sua senha.";
    case "weak_password":
      return "Essa senha é fraca demais. Use pelo menos 6 caracteres.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
    case "otp_expired":
    case "bad_jwt":
      return "Este link expirou ou já foi usado. Solicite um novo.";
    case "validation_failed":
      return "Confira os dados preenchidos e tente novamente.";
    case "signup_disabled":
      return "O cadastro está temporariamente desativado.";
  }

  // Reserva por texto, para instalações que não mandam `code`.
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. O link está na sua caixa de entrada.";
  }
  if (message.includes("already registered")) {
    return "Este e-mail já possui uma conta. Entre ou redefina sua senha.";
  }
  if (message.includes("Password should be at least")) {
    return "Essa senha é curta demais. Use pelo menos 6 caracteres.";
  }
  if (message.includes("should be different from the old password")) {
    return "A nova senha precisa ser diferente da atual.";
  }
  // "For security purposes, you can only request this after N seconds"
  if (message.includes("For security purposes") || message.includes("rate limit")) {
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  }
  if (message.includes("Unable to validate email address")) return "E-mail inválido.";

  return fallback;
}
