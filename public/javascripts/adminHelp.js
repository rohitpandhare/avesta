feather.replace();

// Delete function
function deleteItem(type, id) {
if (!confirm(`Are you sure you want to delete this ${type}?`)) {
return;
}

fetch(`/admin/delete-${type}/${id}`, {
method: 'POST',
headers: {
    'Content-Type': 'application/json'
},
credentials: 'same-origin' // Add this to ensure cookies are sent
})
.then(response => {
if (!response.ok) {
    throw new Error('Network response was not ok');
}
return response.json();
})
.then(data => {
if (data.success) {
    window.location.reload();
} else {
    alert(data.message || 'Delete failed. Please try again.');
}
})
.catch(error => {
console.error('Error:', error);
alert('Delete operation failed. Please try again.');
});
}

// Smooth scroll functionality
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
