document.addEventListener('DOMContentLoaded', function() {
    const patientTab = document.getElementById('patientTab');
    const doctorTab = document.getElementById('doctorTab');
    const patientFields = document.getElementById('patientFields');
    const doctorFields = document.getElementById('doctorFields');
    const selectedRoleInput = document.getElementById('selectedRole'); // Hidden input for form submission

    // Get all input fields within the patient and doctor sections
    const allPatientFields = patientFields.querySelectorAll('input, select, textarea');
    const allDoctorFields = doctorFields.querySelectorAll('input, select, textarea');

    // Function to set or remove 'required' attribute for fields
    function setRequired(fields, isRequired) {
        fields.forEach(field => {
            if (isRequired) {
                field.setAttribute('required', 'true');
            } else {
                field.removeAttribute('required');
                // Optionally clear the value when field is not required
                if (field.type !== 'hidden' && field.type !== 'submit') { // Don't clear hidden or submit fields
                    field.value = '';
                    if (field.tagName === 'SELECT') {
                        field.selectedIndex = 0; // Reset select to first option
                    }
                }
            }
        });
    }

    function showTab(role) {
        // Update hidden input value
        selectedRoleInput.value = role;

        // Reset tab styling for both tabs
        patientTab.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
        patientTab.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
        doctorTab.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
        doctorTab.classList.add('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');

        // Hide all specific field sets
        patientFields.classList.add('hidden');
        doctorFields.classList.add('hidden');
        
        // Remove 'required' from all role-specific fields before showing the active one
        setRequired(allPatientFields, false);
        setRequired(allDoctorFields, false);

        // Show the selected field set and set 'required' for its fields
        if (role === 'PATIENT') {
            patientTab.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            patientTab.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            patientFields.classList.remove('hidden');
            setRequired(allPatientFields, true);
        } else if (role === 'DOCTOR') {
            doctorTab.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            doctorTab.classList.remove('text-gray-300', 'hover:bg-gray-700', 'hover:text-white');
            doctorFields.classList.remove('hidden');
            setRequired(allDoctorFields, true);
        }
    }

    // Event Listeners for tabs
    patientTab.addEventListener('click', () => showTab('PATIENT'));
    doctorTab.addEventListener('click', () => showTab('DOCTOR'));

    // Initialize: show patient fields by default and set them as required
    showTab('PATIENT');
});