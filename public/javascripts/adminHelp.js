let sidebar; // Declare sidebar in a wider scope
function toggleSidebar() {
    if (sidebar) { // Check if sidebar is defined before toggling
        sidebar.classList.toggle('open');
    }
}

function closeSidebar() {
    if (sidebar) { // Check if sidebar is defined before closing
        sidebar.classList.remove('open');
    }
}
// --- END Sidebar functions ---

document.addEventListener('DOMContentLoaded', () => {
    feather.replace();

    sidebar = document.getElementById('sidebar'); // Assign sidebar here
    const hamburger = document.getElementById('hamburger');
    const closeIcon = document.getElementById('close-icon');

    if (hamburger) hamburger.addEventListener('click', toggleSidebar);
    if (closeIcon) closeIcon.addEventListener('click', closeSidebar);
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
    // IMPORTANT: Do NOT use alert() or confirm() in production code.
    // Replace with custom modal UI for better user experience and compatibility.
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
        // IMPORTANT: Do NOT use alert() in production code.
        // Replace with custom modal UI for better user experience and compatibility.
        alert(data.message || `${type} Recovered successfully`);
        window.location.reload();
    })
    .catch(error => {
        console.error(`Error Recovering ${type}:`, error);
        // IMPORTANT: Do NOT use alert() in production code.
        // Replace with custom modal UI for better user experience and compatibility.
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
    hideConfirmModal(); // Hide the first confirmation modal
});

if(confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', () => {
    hideConfirmModal();
});


// Custom message/alert box
const messageBox = document.getElementById('customMessageBox');
const messageText = document.getElementById('customMessageText');
let messageTimeout;

function showMessage(message, type = 'success', duration = 3000) {
    if (!messageBox || !messageText) return;
    messageText.textContent = message;
    messageBox.className = 'custom-message-box'; 
    messageBox.classList.add(type === 'error' ? 'error' : 'success');
    messageBox.classList.add('show');
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        messageBox.classList.remove('show');
    }, duration);
}

// Function to show status messages within the OTP modal
function showOtpStatus(message, color) {
    const otpStatusMessage = document.getElementById('otpStatusMessage');
    if (otpStatusMessage) {
        otpStatusMessage.textContent = message;
        otpStatusMessage.className = `text-center text-${color}-600 text-sm mt-2`;
    }
}


// --- Custom OTP Modal Logic ---
const otpModal = document.getElementById('customOtpModal');
const otpModalTitle = document.getElementById('otpModalTitle');
const otpModalMessage = document.getElementById('otpModalMessage');
const otpUserIdInput = document.getElementById('otpUserId'); // Hidden input for userId
const otpUsernameInput = document.getElementById('otpUsername'); // Hidden input for username
const otpInput = document.getElementById('otpInput');
const verifyAndDeactivateBtn = document.getElementById('verifyAndDeactivateBtn');
const otpModalCancelBtn = document.getElementById('otpModalCancel');

// Function to show OTP modal and automatically request OTP
window.showAndRequestOtpModal = async (type, id, username) => {
    // Set values into the hidden inputs directly
    otpUserIdInput.value = id; 
    otpUsernameInput.value = username;

    otpModalTitle.textContent = `Verify Deactivation for ${username}`;
    otpModalMessage.textContent = `A verification code will be sent to ${username}'s associated email.`;
    otpInput.value = ''; // Clear previous OTP
    showOtpStatus('', 'gray'); // Clear status message
    otpModal.classList.remove('hidden'); // Show the OTP modal

    // Automatically send OTP
    try {
        showOtpStatus(`Sending verification code to ${username}...`, 'blue');

        const response = await fetch('/auth/request-otp-for-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId: id, role: 'ADMIN' }) // Use 'id' directly here
        });

        const data = await response.json();

        if (response.ok) {
            showOtpStatus(`Verification code sent to ${data.email || username}'s email.`, 'green');
        } else {
            showOtpStatus(data.error || 'Failed to send code.', 'red');
        }
    } catch (error) {
        console.error('Error requesting OTP automatically:', error);
        showOtpStatus('Connection error while requesting OTP.', 'red');
    }
};


function hideOtpModal() {
    otpModal.classList.add('hidden');
    // Clear hidden input values on hide
    otpUserIdInput.value = '';
    otpUsernameInput.value = '';
}

if(otpModalCancelBtn) otpModalCancelBtn.addEventListener('click', hideOtpModal);


// Verify & Deactivate button click handler
if(verifyAndDeactivateBtn) verifyAndDeactivateBtn.addEventListener('click', async () => {
    const otp = otpInput.value.trim();
    // Directly get the userId from the hidden input field
    const userIdToDeactivate = otpUserIdInput.value; 

    if (!otp) {
        showOtpStatus('Please enter the verification code.', 'red');
        return;
    }
    
    if (!userIdToDeactivate) {
        showOtpStatus('Error: User ID not found for deactivation.', 'red');
        console.error('Deactivation Error: userIdToDeactivate is empty or null.');
        return;
    }

    try {
        showOtpStatus('Verifying code...', 'blue');

        const verifyOtpResponse = await fetch('/auth/verify-otp-for-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userIdToDeactivate, otp }) // Use userIdToDeactivate for verification
        });

        const verifyOtpResult = await verifyOtpResponse.json();

        if (verifyOtpResult.success) {
            // OTP verification successful!
            showOtpStatus('Verification successful! Proceeding with deactivation...', 'green');
            hideOtpModal(); // Hide OTP modal immediately

            // --- CRUCIAL CHANGE: Call the new deactivation endpoint with URL parameter ---
            // Use userIdToDeactivate directly from the hidden input
            console.log('Attempting to deactivate user with ID from hidden input:', userIdToDeactivate); // New debug log
            const deactivateUserResponse = await fetch(`/admin/deactivate-user/${userIdToDeactivate}`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const deactivateUserResult = await deactivateUserResponse.json();

            if (deactivateUserResult.success) {
                showMessage(deactivateUserResult.message || 'User deactivated successfully!', 'success');
                setTimeout(() => {
                    window.location.reload(); // Reload the page to see changes
                }, 1500); 
            } else {
                showMessage(deactivateUserResult.error || 'Failed to deactivate user.', 'error');
            }
            // --- END CRUCIAL CHANGE ---

        } else {
            // OTP verification failed
            showOtpStatus(verifyOtpResult.error || 'Verification failed. Invalid code or expired.', 'red');
        }
    } catch (error) {
        console.error('Error during OTP verification or deactivation:', error);
        showOtpStatus('An unexpected error occurred during deactivation.', 'red');
    }
});


// --- Delete functionality using Custom Modal and OTP ---
window.confirmDeleteItem = (type, id, itemName = '') => {
    const itemDisplayName = itemName ? ` '${itemName}'` : '';
    window.showConfirmModal(
        `Deactivate ${type}`,
        `Are you sure you want to deactivate this ${type}${itemDisplayName}? This action requires OTP verification.`,
        () => {
            // If initial confirmation is given, show the OTP modal and automatically request OTP
            window.showAndRequestOtpModal(type, id, itemName);
        }
    );
};