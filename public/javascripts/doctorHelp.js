// coommon handler function for all patient search inputs
function setupPatientSearch(inputId, suggestionsId, hiddenId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    // Only proceed if the input element exists on the page
    if (!input || !suggestions) {
        // console.warn(`Elements for patient search not found: inputId=${inputId}, suggestionsId=${suggestionsId}`);
        return;
    }

    input.addEventListener("input", function() {
        let query = this.value.trim();
        if (query.length < 2) {
            suggestions.classList.add("hidden");
            return;
        }

        fetch(`/search-patient?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestions.innerHTML = "";
                if (data.length === 0) {
                    suggestions.innerHTML = "<div class='p-2 text-gray-500'>No patient found</div>";
                } else {
                    data.forEach(patient => {
                        let div = document.createElement("div");
                        div.classList.add("p-2", "cursor-pointer", "hover:bg-gray-100");
                        div.innerText = patient.Name;
                        div.onclick = function() {
                            input.value = patient.Name;
                            document.getElementById(hiddenId).value = patient.PatientID;
                            suggestions.classList.add("hidden");
                        };
                        suggestions.appendChild(div);
                    });
                }
                suggestions.classList.remove("hidden");
            })
            .catch(error => console.error("Error fetching patients:", error));
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function(event) {
        if (!input.contains(event.target) && !suggestions.contains(event.target)) {
            suggestions.classList.add("hidden");
        }
    });
}

// --- Custom Confirmation Modal Functions ---
// These functions are now used by the OTP flow, so currentAction global is no longer needed.
// The `showConfirmModal` and `hideConfirmModal` methods are now part of window object.

/**
 * Shows the custom confirmation modal.
 * @param {string} message - The message to display in the modal.
 * @param {Function} onConfirm - Callback function to execute when 'Confirm' is clicked.
 */
window.showConfirmModal = function(message, onConfirm) {
    const modal = document.getElementById('confirmationModal');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (!modal || !modalMessage || !confirmBtn || !cancelBtn) {
        console.error("Confirmation modal elements not found. Cannot show modal.");
        // Fallback to direct action or a simple alert if modal is critical and missing
        alert(message); // Simple alert as a fallback
        if (confirm('Proceed anyway?')) {
            onConfirm();
        }
        return;
    }

    modalMessage.innerText = message;
    modal.classList.remove('hidden'); // Ensure modal is visible

    // Clone and replace buttons to remove all existing event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newConfirmBtn.addEventListener('click', () => {
        modal.classList.add('hidden'); // Hide modal
        if (onConfirm) {
            onConfirm(); // Execute the callback
        }
    });

    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden'); // Hide modal
    });
};


// Your existing deleteItem function (called after successful OTP verification)
window.deleteItem = async function(itemId, itemType) {
    let url;
    let successMessage;
    let errorMessage;
    let redirectToDashboard = false; // Flag to indicate if we should redirect to dashboard

    switch(itemType) {
        case 'relation': // Matches EJS: 'relation'
            url = `/doctor/deleteRelation/${itemId}`;
            successMessage = 'Patient Relation Deactivated successfully!';
            errorMessage = 'An error occurred while deactivating the patient relation.';
            redirectToDashboard = true; // Redirect after deactivating a patient relation
            break;
        case 'medical-record': // Matches EJS: 'medical-record'
            url = `/doctor/deleteRecord/${itemId}`;
            successMessage = 'Medical Record Deactivated successfully!';
            errorMessage = 'An error occurred while deactivating the medical record.';
            break;
        case 'prescription': // Matches EJS: 'prescription'
            url = `/doctor/deletePres/${itemId}`;
            successMessage = 'Prescription Deactivated successfully!';
            errorMessage = 'An error occurred while deactivating the prescription.';
            break;
        default:
            console.error('Unknown type:', itemType);
            window.showCustomMessage('Unknown action type.', 'error');
            return;
    }

    try {
        const response = await fetch(url, {
            method: 'DELETE' // *** IMPORTANT: Changed method to DELETE ***
        });
        const data = await response.json();

        if (data.success) {
            window.showCustomMessage(successMessage, 'success');
            if (redirectToDashboard) {
                // If patient relation is deactivated, redirect to the dashboard
                window.location.href = '/doctor'; // Redirect to the main doctor dashboard
            } else {
                location.reload(); // For records and prescriptions, just reload the current page
            }
        } else {
            window.showCustomMessage(data.message || errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error during deactivation:', error);
        window.showCustomMessage(`An error occurred while deactivating the ${itemType}.`, 'error');
    }
};
// --- Medicine Search Functionality ---
function setupMedSearch(inputId, suggestionsId, hiddenId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const hiddenInput = document.getElementById(hiddenId);
    let selectedMedicine = null;

    // Only proceed if the input element exists on the page
    if (!input || !suggestions || !hiddenInput) {
        // console.warn(`Elements for medicine search not found: inputId=${inputId}, suggestionsId=${suggestionsId}, hiddenId=${hiddenId}`);
        return;
    }

    input.addEventListener("input", function() {
        let query = this.value.trim();

        if (selectedMedicine && query === selectedMedicine) {
            suggestions.classList.add("hidden");
            return;
        }

        selectedMedicine = null;

        if (query.length < 2) {
            suggestions.classList.add("hidden");
            return;
        }

        fetch(`/search-med?query=${query}`)
            .then(response => response.json())
            .then(data => {
                suggestions.innerHTML = "";
                if (data.length === 0) {
                    suggestions.innerHTML = "<div class='p-2 text-gray-500'>No medicines found</div>";
                    suggestions.classList.remove("hidden");
                } else {
                    data.forEach(medicine => {
                        let div = document.createElement("div");
                        div.classList.add("p-2", "cursor-pointer", "hover:bg-gray-100");
                        div.innerText = medicine.name;
                        div.onclick = function() {
                            input.value = medicine.name;
                            hiddenInput.value = medicine.id; // Store the medicine ID
                            selectedMedicine = medicine.name;
                            suggestions.classList.add("hidden");
                        };
                        suggestions.appendChild(div);
                    });
                    suggestions.classList.remove("hidden");
                }
            })
            .catch(error => {
                console.error("Error fetching medicines:", error);
                suggestions.innerHTML = "<div class='p-2 text-red-500'>Error fetching suggestions</div>";
                suggestions.classList.remove("hidden");
            });
    });

    document.addEventListener('click', function(event) {
        if (!input.contains(event.target) && !suggestions.contains(event.target)) {
            suggestions.classList.add("hidden");
        }
    });
}

// --- Add Medicine (Prescription Form) Functionality ---
// This function needs to be called on the specific page where the "Add Medicine" button and container exist.
// It is not part of the global DOMContentLoaded.
document.getElementById('add-medicine')?.addEventListener('click', function() {
    const container = document.getElementById('medicine-container');
    if (!container) {
        console.error("Medicine container not found for 'add-medicine' button.");
        return;
    }
    const index = container.children.length;
    const newMedicine = container.firstElementChild.cloneNode(true);

    // Update all attributes and names with new index
    newMedicine.setAttribute('data-medicine-index', index);
    newMedicine.querySelectorAll('[name]').forEach(el => {
        el.name = el.name.replace(/\[\d+\]/, `[${index}]`);
        el.id = el.id.replace(/\d+/, index);
        if (el.type === 'checkbox' && !el.name.includes('BeforeFood')) {
            el.checked = el.name.includes('Morning') ||
                                 el.name.includes('Evening') ||
                                 el.name.includes('AfterFood');
        }
    });

    // Clear input values except checkboxes
    newMedicine.querySelectorAll('input[type="text"], textarea').forEach(el => {
        el.value = '';
    });

    container.appendChild(newMedicine);
});

// --- Toast Notification (from your original doctorHelp.js, slightly refined) ---
document.addEventListener('DOMContentLoaded', () => {
    // Function to close toast notification
    function closeToast() {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.style.transform = 'translateX(100%)';
            toast.style.zIndex = '9999';
            setTimeout(() => toast.remove(), 500);
        }
    }

    // Automatically close the toast after 5 seconds
    const toast = document.getElementById('toast');
    if (toast) {
        toast.style.zIndex = '9999';
        setTimeout(closeToast, 5000);
    }
});


// for otp based deletion
// Function to show custom messages (copied from adminHelp.js example)
window.showCustomMessage = function(message, type) {
    const messageBox = document.getElementById('customMessageBox');
    const messageText = document.getElementById('customMessageText');

    // Ensure the message box element exists before proceeding
    if (!messageBox || !messageText) {
        console.error("Custom message box elements not found. Please ensure 'customMessageBox' and 'customMessageText' exist in your HTML.");
        alert(message); // Fallback to a simple alert
        return;
    }

    messageText.textContent = message;
    messageBox.className = 'custom-message-box'; // Reset classes
    messageBox.classList.add('show', type); // Add show and type (success/error) classes
    messageBox.style.display = 'block'; // Make it visible

    // Hide the message after 3 seconds
    setTimeout(() => {
        messageBox.classList.remove('show');
        messageBox.addEventListener('transitionend', () => {
            messageBox.style.display = 'none';
        }, { once: true });
    }, 3000);
};


// Function to initiate the OTP confirmation flow
window.confirmDeleteItemWithOtp = function(itemId, itemType, itemName = '') { // itemName is optional
    const itemDisplayName = itemName ? ` '${itemName}'` : '';
    // Show initial confirmation modal
    window.showConfirmModal(`Are you sure you want to deactivate this ${itemType}${itemDisplayName}? This action requires OTP verification.`, () => {
        // If confirmed, proceed to show OTP modal and request OTP
        window.showAndRequestOtpModal(itemId, itemType);
    });
};


// Function to display OTP modal and send OTP request
window.showAndRequestOtpModal = async function(itemIdForDelete, itemTypeForDelete) {
    const otpModal = document.getElementById('otpModal');
    const otpMessage = document.getElementById('otpMessage');
    const otpInput = document.getElementById('otpInput');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const cancelOtpBtn = document.getElementById('cancelOtpBtn');
    const requestNewOtpBtn = document.getElementById('requestNewOtpBtn');

    // Ensure OTP modal elements exist
    if (!otpModal || !otpMessage || !otpInput || !verifyOtpBtn || !cancelOtpBtn || !requestNewOtpBtn) {
        console.error("OTP modal elements not found. OTP functionality might not work correctly.");
        window.showCustomMessage("OTP verification failed. Please check setup.", "error");
        return;
    }

    otpMessage.textContent = `An OTP has been sent to your registered email to confirm the deactivation of the ${itemTypeForDelete} (ID: ${itemIdForDelete}).`;
    otpInput.value = ''; // Clear previous input
    otpModal.classList.remove('hidden'); // Show the OTP modal
    requestNewOtpBtn.style.display = 'block'; // Ensure request new OTP button is visible

    // Clone and replace buttons to remove all existing event listeners
    const newVerifyOtpBtn = verifyOtpBtn.cloneNode(true);
    const newCancelOtpBtn = cancelOtpBtn.cloneNode(true);
    const newRequestNewOtpBtn = requestNewOtpBtn.cloneNode(true);

    verifyOtpBtn.parentNode.replaceChild(newVerifyOtpBtn, verifyOtpBtn);
    cancelOtpBtn.parentNode.replaceChild(newCancelOtpBtn, cancelOtpBtn);
    requestNewOtpBtn.parentNode.replaceChild(newRequestNewOtpBtn, requestNewOtpBtn);

    const currentVerifyOtpBtn = newVerifyOtpBtn;
    const currentCancelOtpBtn = newCancelOtpBtn;
    const currentRequestNewOtpBtn = newRequestNewOtpBtn;

    // --- Send initial OTP request ---
    try {
        const response = await fetch('/doctor/request-otp-for-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // No body needed as OTP is general for doctor's email
        });
        const data = await response.json();
        if (!data.success) {
            window.showCustomMessage(data.message || 'Failed to send OTP.', 'error');
            otpModal.classList.add('hidden'); // Hide OTP modal if sending fails
            return;
        }
        window.showCustomMessage('OTP sent to your email!', 'success');
    } catch (error) {
        console.error('Error requesting OTP:', error);
        window.showCustomMessage('Error requesting OTP. Please try again.', 'error');
        otpModal.classList.add('hidden'); // Hide OTP modal on error
        return;
    }

    // --- Event Handlers for OTP Modal ---
    const handleVerifyOtp = async () => {
        const otp = otpInput.value.trim();
        if (!otp) {
            window.showCustomMessage('Please enter the OTP.', 'error');
            return;
        }

        currentVerifyOtpBtn.disabled = true; // Disable to prevent multiple clicks
        currentVerifyOtpBtn.textContent = 'Verifying...';

        try {
            const response = await fetch('/doctor/verify-otp-for-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ otp: otp }) // Only sending the OTP
            });
            const data = await response.json();

            if (data.success) {
                window.showCustomMessage('OTP verified successfully. Deactivating item...', 'success');
                otpModal.classList.add('hidden'); // Hide OTP modal
                // Proceed with the actual deletion
                await window.deleteItem(itemIdForDelete, itemTypeForDelete);
            } else {
                window.showCustomMessage(data.message || 'Invalid OTP. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            window.showCustomMessage('Error verifying OTP. Please try again.', 'error');
        } finally {
            currentVerifyOtpBtn.disabled = false;
            currentVerifyOtpBtn.textContent = 'Verify OTP';
        }
    };

    const handleCancelOtp = () => {
        otpModal.classList.add('hidden');
        // Clean up listeners if necessary, though cloning often handles this
    };

    const handleRequestNewOtp = async () => {
        currentRequestNewOtpBtn.disabled = true; // Disable to prevent multiple requests
        currentRequestNewOtpBtn.textContent = 'Sending...';
        try {
            const response = await fetch('/doctor/request-otp-for-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            });
            const data = await response.json();
            if (data.success) {
                window.showCustomMessage('New OTP sent to your email!', 'success');
            } else {
                window.showCustomMessage(data.message || 'Failed to send new OTP.', 'error');
            }
        } catch (error) {
            console.error('Error requesting new OTP:', error);
            window.showCustomMessage('Error requesting new OTP. Please try again.', 'error');
        } finally {
            currentRequestNewOtpBtn.disabled = false;
            currentRequestNewOtpBtn.textContent = 'Request New OTP';
        }
    };

    currentVerifyOtpBtn.addEventListener('click', handleVerifyOtp);
    currentCancelOtpBtn.addEventListener('click', handleCancelOtp);
    currentRequestNewOtpBtn.addEventListener('click', handleRequestNewOtp);
};


// --- Initialize modal handlers when the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', () => {
    // No specific setup functions are needed for modals here anymore,
    // as their event listeners are added/removed dynamically with cloning.
    // Ensure `setupPatientSearch` and `setupMedSearch` are called on relevant pages.
});