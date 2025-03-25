// Initialize Feather Icons
document.addEventListener('DOMContentLoaded', () => {
    feather.replace();
});

// Delete function with detailed logging
function deleteItem(type, id) {
    console.log(`Starting delete operation for ${type} with ID: ${id}`);

    if (!confirm(`Are you sure you want to delete this ${type}?`)) {
        console.log('Delete operation cancelled by user');
        return;
    }

    console.log(`Sending delete request for ${type} ID: ${id}`);
    fetch(`/admin/delete-${type}/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
    })
    .then(response => {
        console.log(`Server response status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Server response data:', data);
        if (data.success) {
            console.log('Delete operation successful, reloading page...');
            window.location.reload();
        } else {
            console.error('Delete operation failed:', data.message);
            alert(data.message || `Failed to delete ${type}`);
        }
    })
    .catch(error => {
        console.error('Delete operation error:', error);
        console.error('Error details:', {
            type: type,
            id: id,
            errorMessage: error.message,
            errorStack: error.stack
        });
        alert(`Failed to delete ${type}. Check console for details.`);
    });
}


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
