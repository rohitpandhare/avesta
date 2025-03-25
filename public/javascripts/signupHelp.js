function toggleExtraFields() {
    const role = document.getElementById('role').value;
    const doctorFields = document.getElementById('doctorFields');
    const patientFields = document.getElementById('patientFields');
    const adminFields = document.getElementById('adminFields');

    // Hide all fields first
    [doctorFields, patientFields, adminFields].forEach(field => 
        field.classList.add('hidden')
    );

    // Enable/disable fields based on role
    document.querySelectorAll('.role-specific-field').forEach(field => {
        field.disabled = true;
        field.required = false;
    });

    if (role === 'DOCTOR') {
        doctorFields.classList.remove('hidden');
        doctorFields.querySelectorAll('.role-specific-field').forEach(field => {
            field.disabled = false;
            field.required = true;
        });

    } else if (role === 'PATIENT') {
        patientFields.classList.remove('hidden');
        patientFields.querySelectorAll('.role-specific-field').forEach(field => {
            field.disabled = false;
            field.required = true;
        });

    } else if (role === 'ADMIN') {
        adminFields.classList.remove('hidden');
        adminFields.querySelectorAll('.role-specific-field').forEach(field => {
            field.disabled = false;
            field.required = true;
        });
    }
}

function handleSpecialty() {
    const specialty = document.getElementById('Specialty');
    const otherSpecGroup = document.getElementById('otherSpecGroup');
    const otherSpecInput = document.querySelector('[name="other_specialty"]');

    if (specialty.value === 'Other') {
        otherSpecGroup.classList.remove('hidden');
        otherSpecInput.disabled = false;
        otherSpecInput.required = true;
    } else {
        otherSpecGroup.classList.add('hidden');
        otherSpecInput.disabled = true;
        otherSpecInput.required = false;
        otherSpecInput.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    toggleExtraFields();
    document.getElementById('role').addEventListener('change', toggleExtraFields);
    document.getElementById('Specialty')?.addEventListener('change', handleSpecialty);
});
