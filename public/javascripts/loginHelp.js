document.getElementById('requestOtpBtn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const role = document.getElementById('role').value;
    const statusEl = document.getElementById('statusMessage');

    if (!username) {
        showStatus('Please enter your username', 'red');
        return;
    }

    try {
        showStatus(`Sending verification code...to ${username}`, 'blue');
        
        const response = await fetch('/auth/request-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('otpSection').classList.remove('hidden');
            document.getElementById('requestOtpBtn').classList.add('hidden');
            document.getElementById('verifyOtpBtn').classList.remove('hidden');

            // Optional masking
            // const maskedEmail = maskEmail(data.email);
            showStatus(`Verification code sent to ${data.email}`, 'green');
        }
        else {
            showStatus(data.error || 'Failed to send code', 'red');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Connection error', 'red');
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const role = document.getElementById('role').value;
    const otp = document.getElementById('otp').value.trim();
    const statusEl = document.getElementById('statusMessage');

    if (!otp) {
        showStatus('Please enter verification code', 'red');
        return;
    }

    try {
        showStatus('Verifying code...', 'blue');
        
        const response = await fetch('/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, role, otp })
        });

        const data = await response.json();
        
        if (response.ok) {
            window.location.href = data.redirectUrl || '/dashboard';
        } else {
            showStatus(data.error || 'Verification failed', 'red');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('Connection error', 'red');
    }
});

function showStatus(message, color) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `text-center text-${color}-600 text-sm`;
}

//  NEW: Form validation + success popup
document.querySelector('form').addEventListener('submit', function(e) {
    const username = document.getElementById('username').value.trim();
  
    const role = document.getElementById('role').value;

    if (!username || !otp || !role) {
        e.preventDefault();
        alert('Please fill in all required fields');
        return;
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const successMessage = urlParams.get('success');
    if (successMessage) {
        alert(successMessage); // Simple popup
    }
});