function toggleExtraFields() {
const role = document.getElementById('role').value;
const doctorFields = document.getElementById('doctorFields');
const patientFields = document.getElementById('patientFields');
const adminFields = document.getElementById('adminFields');

// Hide all fields first
doctorFields.classList.add('hidden');
patientFields.classList.add('hidden');
adminFields.classList.add('hidden');

// Remove required attribute from all fields
document.querySelectorAll('#doctorFields select, #doctorFields input').forEach(input => {
input.required = false;
});
document.querySelectorAll('#patientFields input, #patientFields select').forEach(input => {
input.required = false;
});
document.querySelector('[name="AdminCode"]').required = false;

// Show and make required relevant fields based on role
if (role === 'DOCTOR') {
doctorFields.classList.remove('hidden');
document.querySelector('#specialization').required = true;
} else if (role === 'PATIENT') {
patientFields.classList.remove('hidden');
document.querySelectorAll('#patientFields input, #patientFields select').forEach(input => {
    input.required = true;
});
} else if (role === 'ADMIN') {
adminFields.classList.remove('hidden');
document.querySelector('[name="AdminCode"]').required = true;
}
}

// Keep your existing handleSpecialization function

function handleSpecialization() {
const specializationSelect = document.getElementById('specialization');
const otherSpecializationDiv = document.getElementById('otherSpecialization');
const otherSpecializationInput = document.querySelector('[name="other_specialty"]');

if (specializationSelect.value === 'Other') {
otherSpecializationDiv.classList.remove('hidden');
otherSpecializationInput.required = true;
} else {
otherSpecializationDiv.classList.add('hidden');
otherSpecializationInput.required = false;
otherSpecializationInput.value = ''; // Clear the input when hidden
}
}

// Call the function on page load to show patient fields by default
document.addEventListener('DOMContentLoaded', toggleExtraFields);

