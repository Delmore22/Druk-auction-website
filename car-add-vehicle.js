// Car Add Vehicle Page Script

document.addEventListener('components:ready', function () {
    initAddVehicleToggle();
    initInventoryProviders();
    initAddVehicleForm();
    initBackButton();
});

function initAddVehicleToggle() {
    var toggles = document.querySelectorAll('.option-toggle');
    var importSection = document.getElementById('importInventory');
    var formSection = document.getElementById('addVehicleForm');

    toggles.forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var option = this.getAttribute('data-option');

            // Update active state
            toggles.forEach(function (t) {
                t.classList.remove('active');
            });
            toggle.classList.add('active');

            // Show/hide sections
            if (option === 'import-inventory') {
                importSection.classList.add('active');
                formSection.hidden = true;
            } else {
                importSection.classList.remove('active');
                formSection.hidden = false;
            }
        });
    });
}

function initInventoryProviders() {
    var providerButtons = document.querySelectorAll('.btn-connect');

    providerButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            var provider = this.getAttribute('data-provider');
            handleProviderConnection(provider);
        });
    });
}

function handleProviderConnection(provider) {
    console.log('Connecting to provider:', provider);

    switch (provider) {
        case 'manheim':
            connectManheim();
            break;
        case 'nada':
            connectNADA();
            break;
        case 'csv':
            uploadCSV();
            break;
        default:
            console.log('Unknown provider');
    }
}

function connectManheim() {
    // TODO: Implement Manheim OAuth/API connection
    alert('Manheim integration coming soon...');
    simulateInventoryLoad([
        { id: 1, year: 2019, make: 'Tesla', model: 'Model S', vin: 'VIN123456' },
        { id: 2, year: 2020, make: 'BMW', model: '740i', vin: 'VIN789012' }
    ]);
}

function connectNADA() {
    // TODO: Implement NADA Guides connection
    alert('NADA Guides integration coming soon...');
    simulateInventoryLoad([
        { id: 3, year: 2018, make: 'Mercedes', model: 'E-Class', vin: 'VIN345678' }
    ]);
}

function uploadCSV() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.addEventListener('change', function () {
        if (this.files.length > 0) {
            console.log('Uploading CSV:', this.files[0].name);
            // TODO: Parse CSV and load vehicles
            alert('CSV import from file: ' + this.files[0].name);
        }
    });
    input.click();
}

function simulateInventoryLoad(vehicles) {
    var connectedResources = document.getElementById('connectedResources');
    var resourceList = document.getElementById('resourceList');

    resourceList.innerHTML = '';

    vehicles.forEach(function (vehicle) {
        var vehicleElement = document.createElement('div');
        vehicleElement.className = 'resource-item';
        vehicleElement.innerHTML = '<div>' +
            '<h4>' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + '</h4>' +
            '<p>VIN: ' + vehicle.vin + '</p>' +
            '</div>' +
            '<div class="resource-item-actions">' +
            '<button type="button" class="btn-import-item" data-vehicle-id="' + vehicle.id + '">Import</button>' +
            '</div>';

        resourceList.appendChild(vehicleElement);
    });

    connectedResources.removeAttribute('hidden');
}

function initAddVehicleForm() {
    var form = document.getElementById('addVehicleForm');
    var cancelBtn = document.getElementById('cancelBtn');

    if (!form) return;

    // Handle form submission
    form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (!validateForm()) {
            console.log('Form validation failed');
            return;
        }

        var formData = new FormData(form);
        var vehicleData = {
            year: formData.get('year'),
            make: formData.get('make'),
            model: formData.get('model'),
            color: formData.get('color'),
            engine: formData.get('engine'),
            horsepower: formData.get('horsepower'),
            transmission: formData.get('transmission'),
            bodyType: formData.get('bodyType'),
            mileage: formData.get('mileage'),
            condition: formData.get('condition'),
            description: formData.get('description'),
            reservePrice: formData.get('reservePrice'),
            estimateValue: formData.get('estimateValue'),
            photos: formData.getAll('photos')
        };

        submitVehicle(vehicleData);
    });

    // Handle cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            if (isFormDirty()) {
                if (confirm('Are you sure you want to discard your changes?')) {
                    navigateBack();
                }
            } else {
                navigateBack();
            }
        });
    }
}

function validateForm() {
    var year = document.getElementById('vehicleYear').value;
    var make = document.getElementById('vehicleMake').value;
    var model = document.getElementById('vehicleModel').value;
    var engine = document.getElementById('vehicleEngine').value;
    var bodyType = document.getElementById('vehicleBodyType').value;

    if (!year || !make || !model || !engine || !bodyType) {
        alert('Please fill in all required fields.');
        return false;
    }

    var yearNum = parseInt(year, 10);
    if (yearNum < 1900 || yearNum > 2100) {
        alert('Please enter a valid year between 1900 and 2100.');
        return false;
    }

    return true;
}

function isFormDirty() {
    var form = document.getElementById('addVehicleForm');
    var inputs = form.querySelectorAll('input, select, textarea');

    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.defaultChecked !== input.checked) {
                return true;
            }
        } else if (input.value !== input.defaultValue) {
            return true;
        }
    }

    return false;
}

function submitVehicle(vehicleData) {
    console.log('Submitting vehicle data:', vehicleData);

    // TODO: Send data to server
    // Example API call:
    // fetch('/api/vehicles', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify(vehicleData)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     if (data.success) {
    //         alert('Vehicle added successfully!');
    //         window.location.href = '/car-dashboard.html';
    //     } else {
    //         alert('Error adding vehicle: ' + data.message);
    //     }
    // })
    // .catch(error => {
    //     console.error('Error:', error);
    //     alert('An error occurred while adding the vehicle.');
    // });

    alert('Vehicle data submitted successfully!');
    resetForm();
}

function resetForm() {
    var form = document.getElementById('addVehicleForm');
    if (form) {
        form.reset();
    }
}

function initBackButton() {
    var backButton = document.querySelector('.back-button');
    if (backButton) {
        backButton.addEventListener('click', function (event) {
            event.preventDefault();
            if (isFormDirty()) {
                if (confirm('Are you sure you want to discard your changes?')) {
                    navigateBack();
                }
            } else {
                navigateBack();
            }
        });
    }
}

function navigateBack() {
    // Check if there's a referrer or go to dashboard
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
        history.back();
    } else {
        window.location.href = 'car-dashboard.html';
    }
}
