window.BRAINSTORMING_SUPABASE_CONFIG = {
    url: 'https://chllzkgugwuerlnbltay.supabase.co',
    anonKey: 'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y',
    bucket: 'brainstorming-images'
};

// Single shared client for the whole page — prevents multiple GoTrueClient instances
if (!window._collectorsAllianceClient && window.supabase && typeof window.supabase.createClient === 'function') {
    window._collectorsAllianceClient = window.supabase.createClient(
        'https://chllzkgugwuerlnbltay.supabase.co',
        'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y'
    );
}