const http = require('http');

function request(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => { result += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(result) }); }
        catch(e) { resolve({ status: res.statusCode, data: result }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  try {
    const proRes = await request('/api/auth/login', 'POST', { email: 'pro1@test.com', password: 'password123' });
    const buyerRes = await request('/api/auth/login', 'POST', { email: 'buyer1@test.com', password: 'password123' });
    
    const proToken = proRes.data.token;
    const buyerToken = buyerRes.data.token;
    
    console.log('[1] Availability...');
    const payload = {
      availability: [{
        dayOfWeek: 1,
        startMinute: 210, // 03:30 UTC
        endMinute: 690,   // 11:30 UTC
        timezone: 'UTC'
      }]
    };
    const setAvail = await request('/api/scheduling/availability/weekly', 'PUT', payload, proToken);
    console.log('Avail response:', setAvail.status);

    const checkAvail = await request('/api/scheduling/availability/weekly', 'GET', null, proToken);
    console.log('Avail fetched:', JSON.stringify(checkAvail.data));

    console.log('[2] Create Session Token...');
    const tokenPayload = {
      title: 'Debug Session',
      duration: 60,
      price: 1500,
      description: 'A test session'
    };
    const createTokenRes = await request('/api/marketplace/tokens/mint', 'POST', tokenPayload, proToken);
    console.log('Token mint response:', createTokenRes.status);
    
    const tokenId = createTokenRes.data.id || createTokenRes.data.token?.id || createTokenRes.data.tokenId;
    console.log('TokenID:', tokenId);
    
    console.log('[3] List Session Token...');
    const listRes = await request(`/api/marketplace/tokens/${tokenId}/list`, 'POST', {}, proToken);
    console.log('List response:', listRes.status);

    console.log('[4] Purchase Session Token...');
    const purchaseRes = await request(`/api/marketplace/tokens/${tokenId}/simulate_purchase`, 'POST', {}, buyerToken);
    console.log('Purchase response:', purchaseRes.status, purchaseRes.data?.message || purchaseRes.data);

    console.log('[5] Schedule Session...');
    // We fetch bookings for the buyer first
    const bookingsRes = await request('/api/scheduling/bookings', 'GET', null, buyerToken);
    const bookings = bookingsRes.data || [];
    console.log('Bookings:', bookings.length);
    
    // Attempt schedule
    if (bookings.length > 0) {
       const bId = bookings[0].id;
       const schedRes = await request(`/api/scheduling/bookings/${bId}/schedule`, 'POST', {
          // Send 09:30 UTC -> which implies 15:00 IST in standard conversion.
          // Next Monday is 2026-03-30
          scheduledAt: '2026-03-30T03:30:00.000Z' // 09:00 IST is 03:30 UTC. Must be inside startMinute: 210 and endMinute: 690
       }, proToken); // Pro must schedule it as per backend logic
       console.log('Schedule Response:', schedRes.status, schedRes.data?.message || 'Success');
    }


    
  } catch (err) {
    console.error('Test Failed:', err);
  }
}
runTest();
