// javascripts/signupHelp.js
document.addEventListener('DOMContentLoaded', function() {
    const patientTab = document.getElementById('patientTab');
    const doctorTab = document.getElementById('doctorTab');
    const patientFields = document.getElementById('patientFields');
    const doctorFields = document.getElementById('doctorFields');
    const selectedRoleInput = document.getElementById('selectedRole'); // Hidden input for form submission

    const otherSpecialtyField = document.getElementById('otherSpecialtyField'); // The div containing the 'other_specialty' input
    const specialtySelect = document.getElementById('specialty'); // The doctor's specialty dropdown
    const otherSpecialtyInput = document.getElementById('other_specialty'); // The 'other_specialty' input itself

    // Get all input fields (including selects and textareas) within the patient and doctor sections
    const allPatientFields = patientFields.querySelectorAll('input, select, textarea');
    const allDoctorFields = doctorFields.querySelectorAll('input, select, textarea');

    // Function to set or remove 'required' and 'disabled' attributes for fields
    function setFieldState(fields, enableAndRequire) {
        fields.forEach(field => {
            // Check if the field is the 'other_specialty' input. This is handled separately by the specialty select.
            // Also, exclude the 'Role' hidden input from being disabled/enabled by this general function.
            if (field.id === 'other_specialty' || field.id === 'selectedRole') {
                return; 
            }

            if (enableAndRequire) {
                field.setAttribute('required', 'true');
                field.removeAttribute('disabled'); // Enable the field
            } else {
                field.removeAttribute('required');
                field.setAttribute('disabled', 'true'); // Disable the field to prevent submission
                
                // Optionally clear the value when field is disabled/not required
                if (field.type !== 'hidden' && field.type !== 'submit') {
                    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                        field.value = '';
                    } else if (field.tagName === 'SELECT') {
                        field.selectedIndex = 0; // Reset select to first option (e.g., "Select Qualification")
                    }
                }
            }
        });
    }

    // Function to handle the visibility and state of the 'other_specialty' field
    function handleOtherSpecialtyState() {
        if (specialtySelect.value === 'Other' && selectedRoleInput.value === 'DOCTOR') {
            otherSpecialtyField.classList.remove('hidden');
            if (otherSpecialtyInput) {
                otherSpecialtyInput.setAttribute('required', 'true');
                otherSpecialtyInput.removeAttribute('disabled');
            }
        } else {
            otherSpecialtyField.classList.add('hidden');
            if (otherSpecialtyInput) {
                otherSpecialtyInput.value = ''; // Clear value when hidden
                otherSpecialtyInput.removeAttribute('required');
                otherSpecialtyInput.setAttribute('disabled', 'true');
            }
        }
    }

    function showTab(role) {
        // Update hidden input value
        selectedRoleInput.value = role;

        // Reset tab styling for both tabs
        patientTab.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
        patientTab.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
        doctorTab.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
        doctorTab.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');

        // Hide all specific field sets and disable their fields
        patientFields.classList.add('hidden');
        setFieldState(allPatientFields, false); // Disable patient fields

        doctorFields.classList.add('hidden');
        setFieldState(allDoctorFields, false); // Disable doctor fields
        
        handleOtherSpecialtyState(); // Ensure other specialty is handled on tab switch

        // Show the selected field set and enable/require its fields
        if (role === 'PATIENT') {
            patientTab.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            patientTab.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            patientFields.classList.remove('hidden');
            setFieldState(allPatientFields, true); // Enable and require patient fields
            patientTab.setAttribute('aria-selected', 'true');
            doctorTab.setAttribute('aria-selected', 'false');

        } else if (role === 'DOCTOR') {
            doctorTab.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            doctorTab.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            doctorFields.classList.remove('hidden');
            setFieldState(allDoctorFields, true); // Enable and require doctor fields
            patientTab.setAttribute('aria-selected', 'false');
            doctorTab.setAttribute('aria-selected', 'true');
            handleOtherSpecialtyState(); // Re-evaluate other specialty visibility
        }
    }

    // Event Listeners for tabs
    patientTab.addEventListener('click', () => showTab('PATIENT'));
    doctorTab.addEventListener('click', () => showTab('DOCTOR'));

    // Event listener for specialty select to show/hide 'other_specialty' field dynamically
    specialtySelect.addEventListener('change', handleOtherSpecialtyState);

    // Initialize the tab based on the selected role value (useful for reloads after server-side errors)
    // If locals.role is set from server, use that, otherwise default to PATIENT
    const initialRole = selectedRoleInput.value || 'PATIENT'; 
    showTab(initialRole);
});
