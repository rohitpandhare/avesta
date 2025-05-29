document.addEventListener('DOMContentLoaded', () => {
     feather.replace();
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const closeIcon = document.getElementById('close-icon');

    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('main > section');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
    }

    hamburger.addEventListener('click', toggleSidebar);
    closeIcon.addEventListener('click', closeSidebar);

});

// Smooth scroll functionality
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Delete functionality
function deleteItem(type, id) {
    fetch(`/delete-${type}/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include' 
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.message || `Server error: ${response.status}`);
            });
        }
        return response.json();
    })
    .then(data => {
        showMessage(data.message || `${type} deactivated successfully.`, 'success');
        setTimeout(() => window.location.reload(), 1500); 
    })
    .catch(error => {
        console.error(`Error deactivating ${type}:`, error);
        showMessage(`Failed to deactivate ${type}: ${error.message}`, 'error');
    });
}

// Revive functionality
function ReviveItem(type, id) {
    if (!confirm(`Are you sure you want to revive this ${type}?`)) {
        return;
    }

    fetch(`/revive-${type}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(error => {
                throw new Error(error.message || 'Error occurred');
            });
        }
        return response.json();
    })
    .then(data => {
        alert(data.message || `${type} Recovered successfully`);
        window.location.reload();
    })
    .catch(error => {
        console.error(`Error Recovering ${type}:`, error);
        alert(`Failed to Recover ${type}: ${error.message}`);
    });
}

 // --- Custom Modal and Message Box Logic ---
const confirmModal = document.getElementById('customConfirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const confirmModalConfirmBtn = document.getElementById('confirmModalConfirm');
const confirmModalCancelBtn = document.getElementById('confirmModalCancel');
let confirmCallback = null;

function showConfirmModal(title, message, callback) {
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

if(confirmModalConfirmBtn) confirmModalConfirmBtn.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    hideConfirmModal();
});

if(confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', () => {
    hideConfirmModal();
});


// --- Custom OTP Modal Logic ---
const otpModal = document.getElementById('customOtpModal');
const otpModalTitle = document.getElementById('otpModalTitle');
const otpModalMessage = document.getElementById('otpModalMessage');
const otpUserIdInput = document.getElementById('otpUserId');
const otpUsernameInput = document.getElementById('otpUsername');
const otpInput = document.getElementById('otpInput');
const requestOtpBtn = document.getElementById('requestOtpBtn');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const otpModalCancelBtn = document.getElementById('otpModalCancel');
const otpStatusMessage = document.getElementById('otpStatusMessage');

let currentItemType = '';
let currentItemId = '';

window.showOtpModal = (type, id, username) => {
    currentItemType = type;
    currentItemId = id;
    otpUserIdInput.value = id; // Store ID for fetch calls
    otpUsernameInput.value = username; // Store username for fetch calls
    otpModalTitle.textContent = `Verify Deactivation for ${username}`;
    otpModalMessage.textContent = `A verification code will be sent to ${username}'s associated email.`;
    otpInput.value = ''; // Clear previous OTP
    otpStatusMessage.textContent = ''; // Clear status message
    requestOtpBtn.classList.remove('hidden');
    verifyOtpBtn.classList.add('hidden');
    otpModal.classList.remove('hidden');
};

function hideOtpModal() {
    otpModal.classList.add('hidden');
    currentItemType = '';
    currentItemId = '';
}

if(otpModalCancelBtn) otpModalCancelBtn.addEventListener('click', hideOtpModal);

// Function to show status messages within the OTP modal
function showOtpStatus(message, color) {
    otpStatusMessage.textContent = message;
    otpStatusMessage.className = `text-center text-${color}-600 text-sm mt-2`;
}

// Request OTP button click handler
if(requestOtpBtn) requestOtpBtn.addEventListener('click', async () => {
    const username = otpUsernameInput.value.trim();
    const userId = otpUserIdInput.value.trim(); // Get the user ID
    const role = 'ADMIN'; // Assuming admin is requesting OTP for user deactivation

    if (!username || !userId) {
        showOtpStatus('User information missing for OTP request.', 'red');
        return;
    }

    try {
        showOtpStatus(`Sending verification code to ${username}...`, 'blue');

        const response = await fetch('/auth/request-otp-for-delete', { // New endpoint for delete OTP
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, role }) // Send userId too
        });

        const data = await response.json();

        if (response.ok) {
            requestOtpBtn.classList.add('hidden');
            verifyOtpBtn.classList.remove('hidden');
            showOtpStatus(`Verification code sent to ${data.email || username}'s email.`, 'green');
        } else {
            showOtpStatus(data.error || 'Failed to send code.', 'red');
        }
    } catch (error) {
        console.error('Error requesting OTP:', error);
        showOtpStatus('Connection error while requesting OTP.', 'red');
    }
});

// Verify OTP button click handler
if(verifyOtpBtn) verifyOtpBtn.addEventListener('click', async () => {
    const username = otpUsernameInput.value.trim();
    const userId = otpUserIdInput.value.trim(); // Get the user ID
    const otp = otpInput.value.trim();
    const role = 'ADMIN'; // Assuming admin is verifying OTP for user deactivation

    if (!otp) {
        showOtpStatus('Please enter the verification code.', 'red');
        return;
    }

    try {
        showOtpStatus('Verifying code...', 'blue');

        const response = await fetch('/auth/verify-otp-for-delete', { // New endpoint for delete OTP verification
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, role, otp }) // Send userId too
        });

        const data = await response.json();

        if (response.ok) {
            showOtpStatus('Verification successful! Proceeding with deactivation...', 'green');
            hideOtpModal(); // Hide OTP modal
            deleteItem(currentItemType, currentItemId); // Proceed with deletion
        } else {
            showOtpStatus(data.error || 'Verification failed. Invalid code or expired.', 'red');
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showOtpStatus('Connection error while verifying OTP.', 'red');
    }
});


const messageBox = document.getElementById('customMessageBox');
const messageText = document.getElementById('customMessageText');
let messageTimeout;

function showMessage(message, type = 'success', duration = 3000) {
    if (!messageBox || !messageText) return; // Guard against missing elements
    messageText.textContent = message;
    messageBox.className = 'custom-message-box'; 
    messageBox.classList.add(type === 'error' ? 'error' : 'success');
    messageBox.classList.add('show');
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        messageBox.classList.remove('show');
    }, duration);
}

// --- Delete functionality using Custom Modal and OTP ---
window.confirmDeleteItem = (type, id, itemName = '') => {
    const itemDisplayName = itemName ? ` '${itemName}'` : '';
    window.showConfirmModal(
        `Deactivate ${type}`,
        `Are you sure you want to deactivate this ${type}${itemDisplayName}? This action requires OTP verification.`,
        () => {
            // If initial confirmation is given, show the OTP modal
            window.showOtpModal(type, id, itemName);
        }
    );
};
