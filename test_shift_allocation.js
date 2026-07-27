
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:9001/api';

async function testShiftAllocationAPI() {
    try {
        console.log('Testing Shift Allocation API...');

        // 0. Login
        console.log('0. Authenticating...');
        let password = '';
        try {
            const envPath = path.join(__dirname, 'backend', '.env');
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/AUTH_PASSWORD=(.*)/);
            if (match) {
                password = match[1].trim();
            }
        } catch (e) {
            console.error('Failed to read .env file:', e.message);
        }

        if (!password) {
            console.error('Could not find AUTH_PASSWORD in .env');
            return;
        }

        let loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.statusText}`);
        let loginData = await loginResponse.json();
        const token = loginData.token;
        console.log('Login successful, token received.');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // 1. Get all allocations
        console.log('1. Fetching all allocations...');
        let response = await fetch(`${API_URL}/shift-allocations`, { headers });
        if (!response.ok) throw new Error(`Failed to fetch allocations: ${response.statusText}`);
        let data = await response.json();
        console.log('Current allocations count:', data.length);

        // 2. Upsert allocations
        console.log('2. Upserting allocations...');
        // Fetch shifts
        let shiftsResponse = await fetch(`${API_URL}/shifts`, { headers });
        if (!shiftsResponse.ok) throw new Error(`Failed to fetch shifts: ${shiftsResponse.statusText}`);
        let shiftsData = await shiftsResponse.json();

        if (shiftsData.length === 0) {
            console.error('No shifts found. Cannot test allocation without shifts.');
            return;
        }
        const shiftId = shiftsData[0]._id;
        console.log('Using shift ID:', shiftId);

        const allocationsToSave = [
            {
                dayOfWeek: 'Monday',
                shiftId: shiftId,
                requiredCount: 5
            },
            {
                dayOfWeek: 'Tuesday',
                shiftId: shiftId,
                requiredCount: 3
            }
        ];

        response = await fetch(`${API_URL}/shift-allocations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(allocationsToSave)
        });

        if (!response.ok) throw new Error(`Failed to upsert allocations: ${response.statusText}`);
        console.log('Upsert response:', response.status);

        // 3. Verify updates
        console.log('3. Verifying updates...');
        response = await fetch(`${API_URL}/shift-allocations`, { headers });
        if (!response.ok) throw new Error(`Failed to verify allocations: ${response.statusText}`);
        data = await response.json();

        const mondayAlloc = data.find(a => a.dayOfWeek === 'Monday' && (a.shiftId._id === shiftId || a.shiftId === shiftId));
        const tuesdayAlloc = data.find(a => a.dayOfWeek === 'Tuesday' && (a.shiftId._id === shiftId || a.shiftId === shiftId));

        if (mondayAlloc && mondayAlloc.requiredCount === 5) {
            console.log('SUCCESS: Monday allocation verified (5)');
        } else {
            console.error('FAILURE: Monday allocation mismatch', mondayAlloc);
        }

        if (tuesdayAlloc && tuesdayAlloc.requiredCount === 3) {
            console.log('SUCCESS: Tuesday allocation verified (3)');
        } else {
            console.error('FAILURE: Tuesday allocation mismatch', tuesdayAlloc);
        }

        // 4. Update again (modify count)
        console.log('4. Updating allocation count...');
        allocationsToSave[0].requiredCount = 10; // Change Monday to 10

        response = await fetch(`${API_URL}/shift-allocations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(allocationsToSave)
        });
        if (!response.ok) throw new Error(`Failed to update allocations: ${response.statusText}`);

        response = await fetch(`${API_URL}/shift-allocations`, { headers });
        data = await response.json();
        const updatedMonday = data.find(a => a.dayOfWeek === 'Monday' && (a.shiftId._id === shiftId || a.shiftId === shiftId));

        if (updatedMonday && updatedMonday.requiredCount === 10) {
            console.log('SUCCESS: Monday allocation updated to 10');
        } else {
            console.error('FAILURE: Monday allocation update failed', updatedMonday);
        }

        console.log('Shift Allocation API Test Completed.');

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testShiftAllocationAPI();
