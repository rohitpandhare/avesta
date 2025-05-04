
// coommon handler function for all patient search inputs
function setupPatientSearch(inputId, suggestionsId, hiddenId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    
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

// Initialize all search inputs
document.addEventListener('DOMContentLoaded', function() {
    setupPatientSearch('patientNameAddPat', 'suggestionsAddPat', 'patientIDHiddenAddPat');
    setupPatientSearch('patientNameMedRec', 'suggestionsMedRec', 'patientIDHiddenMedRec');
    setupPatientSearch('patientNamePres', 'suggestionsPres', 'patientIDHiddenPres');
});

//common delete func
function deleteItem(id, type) {
    let confirmMessage;
    let url;

    // Determine the URL and confirmation message based on the type
    switch(type) {
        case 'relation':
            confirmMessage = `Are you sure you want to delete this Relation?`;
            url = `/doctor/deleteRelation/${id}`;
            break;
        case 'record':
            confirmMessage = `Are you sure you want to delete this Record?`;
            url = `/doctor/deleteRecord/${id}`;
            break;
        case 'prescription':
            confirmMessage = `Are you sure you want to delete this Prescription?`;
            url = `/doctor/deletePres/${id}`;
            break;
        default:
            console.error('Unknown type:', type);
            return; // Exit if type is unknown
    }

    // Show confirmation dialog
    if (!confirm(confirmMessage)) {
        return; // Exit if the user cancels
    }

    // Perform the delete operation
    fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include' // Ensure cookies are sent with the request
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(error => {
                throw new Error(error.message || `An error occurred while deleting the ${type}s.`);
            });
        }
        return response.json(); // Parse JSON response on success
    })
    .then(data => {
        // Redirect instead of reload to prevent form resubmission
        window.location.href = '/doctor?success=' + encodeURIComponent(data.message);
    })
    .catch(error => {
        console.error('Error deleting:', error);
        alert(`Failed to delete: ${error.message}`);
    });
}

//sidebar ffunc
document.addEventListener('DOMContentLoaded', () => {
        // Sidebar functionality
        const sidebar = document.querySelector('aside');
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
    
  document.getElementById('add-medicine').addEventListener('click', function() {
      const container = document.getElementById('medicine-container');
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

  function setupMedSearch(inputId, suggestionsId, hiddenId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const hiddenInput = document.getElementById(hiddenId);
    let selectedMedicine = null;

    input.addEventListener("input", function() {
        let query = this.value.trim();

        // If the input value matches the selected medicine, don't show suggestions
        if (selectedMedicine && query === selectedMedicine) {
            suggestions.classList.add("hidden");
            return;
        }

        // Reset selectedMedicine if the user modifies the input
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

// Initialize all search inputs
document.addEventListener('DOMContentLoaded', function() {
    setupMedSearch('medName', 'suggestMed', 'hiddenMed');
});
