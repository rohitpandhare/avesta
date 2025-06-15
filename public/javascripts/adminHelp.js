// adminHelp.js

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

// IMPORTANT: This 'deleteItem' function should now primarily use the modal flow.
// This function might be deprecated or modified to call confirmDeleteItem directly.
// For now, keeping it as is but noting its relationship with the new modal flow.
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

// IMPORTANT: This 'ReviveItem' function should now primarily use the modal flow.
// It will be replaced by the custom modal and OTP flow below.
// For now, commenting out as it will be superseded.
/*
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
*/

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
    // Remove event listeners to prevent multiple firings
    confirmModalConfirmBtn.removeEventListener('click', confirmModalHandler);
    confirmModalCancelBtn.removeEventListener('click', confirmModalHandler);
}

// Central handler for confirm modal buttons to prevent multiple listeners
const confirmModalHandler = (event) => {
    if (event.target === confirmModalConfirmBtn && confirmCallback) {
        confirmCallback();
    }
    hideConfirmModal();
};

if(confirmModalConfirmBtn) confirmModalConfirmBtn.addEventListener('click', confirmModalHandler);
if(confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', confirmModalHandler);


// Custom message/alert box
const messageBox = document.getElementById('customMessageBox');
const messageText = document.getElementById('customMessageText');
let messageTimeout;

function showMessage(message, type = 'success', duration = 3000) {  const box = document.getElementById('customMessageBox');
    const text = document.getElementById('customMessageText');
    if (!box || !text) return;

    text.textContent = message;
    box.className = 'custom-message-box';
    box.classList.add('show', type);
    box.style.display = 'block';

    setTimeout(() => {
        box.classList.remove('show');
        box.addEventListener('transitionend', () => {
            box.style.display = 'none';
        }, { once: true });
    }, 3000);

    // Clear any existing timeout to prevent multiple messages stacking
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
        // Use Tailwind CSS text colors
        otpStatusMessage.className = `text-center text-${color}-600 text-sm mt-2`;
    }
}


// --- Custom OTP Modal Logic (for Deactivation) ---
const otpModal = document.getElementById('customOtpModal'); // This is the main OTP modal element
const otpModalTitle = document.getElementById('otpModalTitle');
const otpModalMessage = document.getElementById('otpModalMessage');
const otpUserIdInput = document.getElementById('otpUserId'); // Hidden input for userId
const otpUsernameInput = document.getElementById('otpUsername'); // Hidden input for username
const otpInput = document.getElementById('otpInput'); // The OTP input field
const verifyAndDeactivateBtn = document.getElementById('verifyAndDeactivateBtn'); // Specific button for deactivation
const otpModalCancelBtn = document.getElementById('otpModalCancel');

// Function to show OTP modal and automatically request OTP for DEACTIVATION
window.showAndRequestOtpModalForDeactivation = async (type, id, username) => {
    otpUserIdInput.value = id;
    otpUsernameInput.value = username;

    otpModalTitle.textContent = `Verify Deactivation for ${username}`;
    otpModalMessage.textContent = `A verification code will be sent to ${username}'s associated email.`;
    otpInput.value = ''; // Clear previous OTP
    showOtpStatus('', 'gray'); // Clear status message
    otpModal.classList.remove('hidden'); // Show the OTP modal

    // Ensure the correct button is active for deactivation
    if (verifyAndDeactivateBtn) verifyAndDeactivateBtn.style.display = 'inline-block';
    if (document.getElementById('verifyAndActivateBtn')) document.getElementById('verifyAndActivateBtn').style.display = 'none';


    // Automatically send OTP
    try {
        showOtpStatus(`Sending verification code for ${username}...`, 'blue');

        const response = await fetch('/auth/request-otp-for-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId: id, role: 'ADMIN' })
        });

        const data = await response.json();

        if (response.ok) {
            showOtpStatus(`Verification code sent to ${data.email || username}'s email.`, 'green');
        } else {
            showOtpStatus(data.error || 'Failed to send code.', 'red');
        }
    } catch (error) {
        console.error('Error requesting OTP automatically for deactivation:', error);
        showOtpStatus('Connection error while requesting OTP.', 'red');
    }
};

// Common function to hide OTP modal
function hideOtpModal() {
    otpModal.classList.add('hidden');
    // Clear hidden input values on hide
    otpUserIdInput.value = '';
    otpUsernameInput.value = '';
    otpInput.value = ''; // Also clear the OTP input
    showOtpStatus('', 'gray'); // Clear any status message
}

if(otpModalCancelBtn) otpModalCancelBtn.addEventListener('click', hideOtpModal);


// Verify & Deactivate button click handler
if(verifyAndDeactivateBtn) verifyAndDeactivateBtn.addEventListener('click', async () => {
    const otp = otpInput.value.trim();
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
            body: JSON.stringify({ userId: userIdToDeactivate, otp })
        });

        const verifyOtpResult = await verifyOtpResponse.json();

        if (verifyOtpResult.success) {
            showOtpStatus('Verification successful! Proceeding with deactivation...', 'green');
            // Do NOT hide OTP modal immediately if a follow-up action is pending
            // hideOtpModal(); // Will hide after deactivation response

            // --- CRUCIAL CHANGE: Call the new deactivation endpoint with URL parameter ---
            const deactivateUserResponse = await fetch(`/admin/deactivate-user/${userIdToDeactivate}`, {
                method: 'POST', // Assuming your route expects POST for deactivation
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const deactivateUserResult = await deactivateUserResponse.json();

            if (deactivateUserResult.success) {
                showMessage(deactivateUserResult.message || 'User deactivated successfully!', 'success');
                hideOtpModal(); // Hide OTP modal after successful deactivation
                setTimeout(() => {
                    window.location.reload(); // Reload the page to see changes
                }, 1500);
            } else {
                showMessage(deactivateUserResult.error || 'Failed to deactivate user.', 'error');
                showOtpStatus(deactivateUserResult.error || 'Deactivation failed.', 'red'); // Show error in OTP modal too
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
    showConfirmModal(
        `Deactivate ${type}`,
        `Are you sure you want to deactivate this ${type}${itemDisplayName}? This action requires OTP verification.`,
        () => {
            // If initial confirmation is given, show the OTP modal and automatically request OTP for DEACTIVATION
            window.showAndRequestOtpModalForDeactivation(type, id, itemName);
        }
    );
};


// --- New OTP Modal Logic (for Activation) ---
const verifyAndActivateBtn = document.getElementById('verifyAndActivateBtn'); // New button for activation

// Function to show OTP modal and automatically request OTP for ACTIVATION
window.showAndRequestOtpModalForActivation = async (type, id, username) => {
    otpUserIdInput.value = id;
    otpUsernameInput.value = username; // Still using same hidden inputs

    otpModalTitle.textContent = `Verify Activation for ${username}`;
    otpModalMessage.textContent = `A verification code will be sent to the admin's email for confirmation.`; // Assuming OTP sent to admin for security
    otpInput.value = ''; // Clear previous OTP
    showOtpStatus('', 'gray'); // Clear status message
    otpModal.classList.remove('hidden'); // Show the OTP modal

    // Ensure the correct button is active for activation
    if (verifyAndActivateBtn) verifyAndActivateBtn.style.display = 'inline-block';
    if (verifyAndDeactivateBtn) verifyAndDeactivateBtn.style.display = 'none';


    // Automatically send OTP (to the admin's email for this action)
    try {
        showOtpStatus(`Sending verification code to admin's email...`, 'blue');

        // You'll need a new backend endpoint for requesting OTP for activation
        const response = await fetch('/auth/request-otp-for-activate', { // Assuming this endpoint exists and sends OTP to admin
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id, role: 'ADMIN' }) // Sending user ID for context, but OTP is for admin
        });

        const data = await response.json();

        if (response.ok) {
            showOtpStatus(`Verification code sent to your admin email.`, 'green');
        } else {
            showOtpStatus(data.error || 'Failed to send code.', 'red');
        }
    } catch (error) {
        console.error('Error requesting OTP automatically for activation:', error);
        showOtpStatus('Connection error while requesting OTP for activation.', 'red');
    }
};

// Verify & Activate button click handler
if(verifyAndActivateBtn) verifyAndActivateBtn.addEventListener('click', async () => {
    const otp = otpInput.value.trim();
    const userIdToActivate = otpUserIdInput.value;

    if (!otp) {
        showOtpStatus('Please enter the verification code.', 'red');
        return;
    }

    if (!userIdToActivate) {
        showOtpStatus('Error: User ID not found for activation.', 'red');
        console.error('Activation Error: userIdToActivate is empty or null.');
        return;
    }

    try {
        showOtpStatus('Verifying code...', 'blue');

        // You'll need a new backend endpoint for verifying OTP for activation
        const verifyOtpResponse = await fetch('/auth/verify-otp-for-activate', { // Assuming this endpoint exists
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userIdToActivate, otp }) // Send userId for context, but OTP is for admin
        });

        const verifyOtpResult = await verifyOtpResponse.json();

        if (verifyOtpResult.success) {
            showOtpStatus('Verification successful! Proceeding with activation...', 'green');
            // Do NOT hide OTP modal immediately if a follow-up action is pending

            const activateUserResponse = await fetch(`/admin/activate-user/${userIdToActivate}`, { // Assuming this route expects POST
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const activateUserResult = await activateUserResponse.json();

            if (activateUserResult.success) {
                showMessage(activateUserResult.message || 'User activated successfully!', 'success');
                hideOtpModal(); // Hide OTP modal after successful activation
                setTimeout(() => {
                    window.location.reload(); // Reload the page to see changes
                }, 1500);
            } else {
                showMessage(activateUserResult.error || 'Failed to activate user.', 'error');
                showOtpStatus(activateUserResult.error || 'Activation failed.', 'red'); // Show error in OTP modal too
            }

        } else {
            // OTP verification failed
            showOtpStatus(verifyOtpResult.error || 'Verification failed. Invalid code or expired.', 'red');
        }
    } catch (error) {
        console.error('Error during OTP verification or activation:', error);
        showOtpStatus('An unexpected error occurred during activation.', 'red');
    }
});


// --- New Activate functionality using Custom Modal and OTP ---
window.confirmActivateItem = (type, id, itemName = '') => {
    const itemDisplayName = itemName ? ` '${itemName}'` : '';
    showConfirmModal(
        `Activate ${type}`,
        `Are you sure you want to activate this ${type}${itemDisplayName}? This action requires OTP verification.`,
        () => {
            // If initial confirmation is given, show the OTP modal and automatically request OTP for ACTIVATION
            window.showAndRequestOtpModalForActivation(type, id, itemName);
        }
    );
};