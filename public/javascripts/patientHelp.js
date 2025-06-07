 // Tab switching logic
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });

            document.getElementById('content-' + tabId).classList.remove('hidden');
            document.getElementById('tab-' + tabId).classList.add('active');

            // Optional: Update URL hash for direct linking to tabs
            history.replaceState(null, '', `#${tabId}`);
        }
        document.addEventListener('DOMContentLoaded', () => {

            // Get initial tab from URL hash or default to 'profile'
            const initialTab = window.location.hash.substring(1) || 'profile';
            showTab(initialTab);

            // Profile edit/view mode toggle
            const viewMode = document.getElementById('viewMode');
            const editMode = document.getElementById('editMode');
            const editProfileBtn = document.getElementById('editProfileBtn');
            const cancelEditBtn = document.getElementById('cancelEditBtn');
            const editForm = document.getElementById('editMode');

            if (editProfileBtn) {
                editProfileBtn.addEventListener('click', () => {
                    viewMode.classList.add('hidden');
                    editMode.classList.remove('hidden');
                });
            }

            if (cancelEditBtn) {
                cancelEditBtn.addEventListener('click', () => {
                    editMode.classList.add('hidden');
                    viewMode.classList.remove('hidden');
                    // Optionally reset form if you want to discard unsaved changes
                    editForm.reset();
                });
            }

            // Handle form submission via fetch API for a smoother experience
            if (editForm) {
                editForm.addEventListener('submit', async (event) => {
                    event.preventDefault(); // Prevent default form submission

                    const formData = new FormData(editForm);
                    const data = Object.fromEntries(formData.entries());

                    const actionUrl = editForm.getAttribute('action');

                    try {
                        const response = await fetch(actionUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(data)
                        });

                        const result = await response.json();

                        if (result.success) {
                            alert(result.message); // Use a custom modal/toast instead of alert in production
                            // Refresh the page to show updated data and reset to view mode
                            window.location.reload();
                        } else {
                            alert('Error: ' + result.message); // Use a custom modal/toast
                        }
                    } catch (error) {
                        console.error('Error submitting form:', error);
                        alert('An unexpected error occurred. Please try again.'); // Use a custom modal/toast
                    }
                });
            }
        });

    document.addEventListener('DOMContentLoaded', () => {
      const mainContent = document.getElementById('main-content');
      const pageTitle = document.getElementById('page-title');
      const pageDescription = document.getElementById('page-description');
      const main = document.querySelector('main');
      const sidebar = document.getElementById('sidebar');
      const hamburger = document.getElementById('hamburger');
      const closeIcon = document.getElementById('close-icon');

    function toggleSidebar() {
        sidebar.classList.toggle('open');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
    }

    hamburger.addEventListener('click', toggleSidebar);
    closeIcon.addEventListener('click', closeSidebar);

    function closeToast() {
        const toast = document.getElementById('toast');
        if (toast) {
          toast.style.transform = 'translateX(100%)'; // Slide out to the right
          setTimeout(() => toast.remove(), 500); // Remove after animation
        }
      }

    // Automatically hide toast after 5 seconds
    setTimeout(function() {
        var toast = document.getElementById('toast');
        if (toast) {
            toast.style.display = 'none';
        }
    }, 5000);

    document.querySelectorAll(".view-prescription-btn").forEach(button => {
    button.addEventListener("click", function () {
        const refId = this.getAttribute("data-refid");
        if (refId) {
            // to only keep the last 6 numbers of the refId
            const lastSixDigits = refId.slice(-6);  
            // Open the prescription in a new tab

            window.open(`/printPrescription/${lastSixDigits}`, '_blank');
        }
    });
});

});
