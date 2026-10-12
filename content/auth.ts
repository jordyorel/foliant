const en = {
  guest: "Guest", signIn: "Sign in", title: "Your Foliant account", email: "Email address",
  send: "Send sign-in link", change: "Change email", resend: "Resend link",
  sent: "Open the sign-in link sent to your email. This page will update automatically after confirmation.",
  intro: "Sign in or create an account to save your documents and their versions.",
  unavailable: "Sign-in is temporarily unavailable.", error: "Unable to continue. Please try again.",
  invalid: "This code is invalid or has expired.", rateLimit: "Please wait before requesting another code.",
  close: "Close", signOut: "Sign out", temporary: "Temporary document", save: "Sign in to save",
  saved: "Saved in your account", signOutConfirm: "Sign out of this account?", wait: "Please wait"
};

const translations: Record<string, typeof en> = {
  en,
  fr: {
    guest: "Invité", signIn: "Se connecter", title: "Votre compte Foliant", email: "Adresse e-mail",
    send: "Recevoir le lien de connexion", change: "Changer d'adresse", resend: "Renvoyer le lien",
    sent: "Ouvrez le lien de connexion reçu par e-mail. Cette page se mettra à jour automatiquement après confirmation.",
    intro: "Connectez-vous ou créez un compte pour conserver vos documents et leurs versions.",
    unavailable: "La connexion est momentanément indisponible.", error: "Impossible de continuer. Réessayez.",
    invalid: "Ce code est incorrect ou a expiré.", rateLimit: "Patientez avant de demander un nouveau code.",
    close: "Fermer", signOut: "Se déconnecter", temporary: "Document temporaire", save: "Se connecter pour enregistrer",
    saved: "Enregistré dans votre compte", signOutConfirm: "Se déconnecter de ce compte ?", wait: "Patientez"
  },
  es: {
    guest: "Invitado", signIn: "Iniciar sesión", title: "Tu cuenta Foliant", email: "Correo electrónico",
    send: "Recibir enlace de acceso", change: "Cambiar correo", resend: "Reenviar enlace",
    sent: "Abre el enlace de acceso recibido por correo. Esta página se actualizará automáticamente tras la confirmación.",
    intro: "Inicia sesión o crea una cuenta para guardar tus documentos y sus versiones.",
    unavailable: "El acceso no está disponible temporalmente.", error: "No se puede continuar. Inténtalo de nuevo.",
    invalid: "El código no es válido o ha caducado.", rateLimit: "Espera antes de solicitar otro código.",
    close: "Cerrar", signOut: "Cerrar sesión", temporary: "Documento temporal", save: "Inicia sesión para guardar",
    saved: "Guardado en tu cuenta", signOutConfirm: "¿Cerrar sesión?", wait: "Espera"
  },
  pt: {
    guest: "Convidado", signIn: "Entrar", title: "Sua conta Foliant", email: "E-mail",
    send: "Receber link de acesso", change: "Alterar e-mail", resend: "Reenviar link",
    sent: "Abra o link de acesso recebido por e-mail. Esta página será atualizada automaticamente após a confirmação.",
    intro: "Entre ou crie uma conta para salvar seus documentos e suas versões.",
    unavailable: "O acesso está temporariamente indisponível.", error: "Não foi possível continuar. Tente novamente.",
    invalid: "O código é inválido ou expirou.", rateLimit: "Aguarde antes de solicitar outro código.",
    close: "Fechar", signOut: "Sair", temporary: "Documento temporário", save: "Entre para salvar",
    saved: "Salvo na sua conta", signOutConfirm: "Sair desta conta?", wait: "Aguarde"
  }
};

export function getAuthCopy(locale: string) { return translations[locale] ?? en; }
