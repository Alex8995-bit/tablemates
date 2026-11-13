// Impostazioni del tuo server. Le trovi in Supabase → Project Settings → API Keys (e nel pulsante Connect).
// Così chi apre un invito non deve configurare nulla.
// Lasciali vuoti per usare l'app solo su questo dispositivo, senza account.
window.CFG = {
  sbUrl: '',        // Project URL, es. https://abcdxyz.supabase.co
  sbKey: '',        // chiave "publishable" (inizia con sb_publishable_)
  vapidPublic: ''   // chiave pubblica per le notifiche (vedi la guida, passo "Notifiche")
};
