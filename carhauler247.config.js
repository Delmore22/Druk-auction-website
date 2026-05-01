window.CARHAULER247_API_CONFIG = {
    // Public API can be used without an API key.
    // Keep false until you're ready to switch from demo fallback to live calls.
    enabled: true,

    baseUrl: 'https://carhauler247.com',

    endpoint: '/api/public/v1/quote',

    // Docs indicate no API key required for public endpoint.
    apiKey: '',
    apiKeyHeader: 'x-api-key',

    // Exact query params from docs.
    originParam: 'fromZip',
    destinationParam: 'toZip',
    vehicleTypeParam: 'vehicleType',
    vehicleTypeValue: 'sedan',
    isOperationalParam: 'isOperational',
    isOperationalValue: true,

    // Fallback when listing pickup has no ZIP code.
    defaultFromZip: '60601',

    // Request timeout in milliseconds.
    timeoutMs: 10000
};
