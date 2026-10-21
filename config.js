/*
 * Configuración pública de la web de Pista (planes, invitaciones, lista de espera, embajadores y admin).
 *
 * La clave publishable está pensada para ir en el navegador: solo permite lo que dejan las políticas
 * RLS y las funciones abiertas al rol anon (public_plan, public_invite, waitlist_*, ambassador_click).
 * Nunca pongas aquí la secret key, la service_role ni la contraseña de la base de datos.
 */
window.PISTA_CONFIG = {
  SUPABASE_URL: "https://tthnmvqtpxaqujrhdekq.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_Tfu2ONzrWc3m9qMg2kTPMA_-I7A1uen",
  // Vacío hasta que la app esté en la App Store; entonces, "https://apps.apple.com/app/id<ID>"
  // aquí y en APP_STORE_ID de _tools/build_home.py.
  APP_STORE_URL: "",
  SITE_URL: "https://pista.one"
};
