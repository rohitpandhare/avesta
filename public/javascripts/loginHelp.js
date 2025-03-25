// Updated loginHelp.js
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
        adminCodeInput.value = ''; // Clear admin code when switching roles
    }
}

// Form validation
document.querySelector('form').addEventListener('submit', function(e) {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const role = document.getElementById('role').value;
    const adminCode = document.getElementById('adminCode');

    // Basic validation
    if (!username || !password || !role) {
        e.preventDefault();
        alert('Please fill in all required fields');
        return;
    }

    // Admin code validation
    if (role === 'ADMIN') {
        if (!adminCode.value.trim()) {
            e.preventDefault();
            alert('Admin code is required');
            adminCode.focus();
            return;
        }
    }
});

// Initialize admin code visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    toggleAdminCode();
});
