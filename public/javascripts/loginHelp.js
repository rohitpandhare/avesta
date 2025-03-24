// public/javascripts/loginHelp.js
function toggleAdminCode() {
    const roleSelect = document.getElementById('role');
    const adminCodeSection = document.getElementById('adminCodeSection');
    const adminCodeInput = document.getElementById('adminCode');
    
    if (roleSelect.value === 'ADMIN') {
        adminCodeSection.classList.remove('hidden');
        adminCodeInput.required = true;
    } else {
        adminCodeSection.classList.add('hidden');
        adminCodeInput.required = false;
    }
}


// Add form validation for admin code
document.querySelector('form').addEventListener('submit', function(e) {
    const roleSelect = document.getElementById('role');
    const adminCodeInput = document.getElementById('adminCode');

    if (roleSelect.value === 'ADMIN') {
        if (adminCodeInput.value !== '007') {
            e.preventDefault();
            alert('Invalid admin code');
            adminCodeInput.value = '';
            adminCodeInput.focus();
        }
    }
});

document.getElementById('loginForm').onsubmit = function (e) {
    const usernameField = document.getElementById('username');
    const roleField = document.getElementById('role');

    // Add Client-side Validations (optional)
    if (!usernameField.value || !roleField.value) {
        e.preventDefault();
        alert('Please fill in all fields.');
    }
};
