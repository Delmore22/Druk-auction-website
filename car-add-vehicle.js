// Car Add Vehicle Page Script

document.addEventListener('components:ready', function () {
    initAddVehicleToggle();
    initInventoryProviders();
    initAddVehicleForm();
    initManualEntryEnhancements();
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
        var vehicleData = serializeFormData(formData);
        var auctionWindow = deriveAuctionWindowFromFormData(formData);

        if (auctionWindow) {
            vehicleData.auctionStartAt = auctionWindow.startAt;
            vehicleData.auctionEndAt = auctionWindow.endAt;
        }

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

function initManualEntryEnhancements() {
    initConditionRowButtons();
    initKeyRowButtons();
    initEquipmentCheckAll();
    initAnnouncementCounter();
    initPhotoPreview();
    initListingDurationPreview();
    initManualJumpNavigation();
}

function initManualJumpNavigation() {
    var jumpLinks = Array.prototype.slice.call(document.querySelectorAll('.manual-jump .jump-link'));
    if (jumpLinks.length === 0) return;

    var sections = jumpLinks
        .map(function (link) {
            var sectionId = link.getAttribute('data-section');
            return document.getElementById(sectionId);
        })
        .filter(function (section) {
            return !!section;
        });

    if (sections.length === 0) return;

    var getStickyOffset = function () {
        var offset = 16;
        var header = document.querySelector('.top-header');
        var jump = document.querySelector('.manual-jump');

        if (header) {
            var headerStyle = window.getComputedStyle(header);
            if (headerStyle.position === 'sticky' || headerStyle.position === 'fixed') {
                offset += header.offsetHeight;
            }
        }

        if (jump) {
            var jumpStyle = window.getComputedStyle(jump);
            if (jumpStyle.position === 'sticky') {
                offset += jump.offsetHeight + 10;
            }
        }

        return offset;
    };

    var setActive = function (sectionId) {
        jumpLinks.forEach(function (link) {
            var isActive = link.getAttribute('data-section') === sectionId;
            link.classList.toggle('active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    var updateActiveFromScroll = function () {
        var offset = getStickyOffset();
        var currentSectionId = sections[0].id;

        sections.forEach(function (section) {
            if (section.getBoundingClientRect().top - offset <= 0) {
                currentSectionId = section.id;
            }
        });

        setActive(currentSectionId);
    };

    var updateCompletion = function () {
        jumpLinks.forEach(function (link) {
            var sectionId = link.getAttribute('data-section');
            var section = document.getElementById(sectionId);
            if (!section) return;

            var requiredControls = section.querySelectorAll('input[required], select[required], textarea[required]');
            if (requiredControls.length === 0) {
                link.classList.remove('completed');
                return;
            }

            var isComplete = Array.prototype.every.call(requiredControls, function (control) {
                return control.checkValidity();
            });

            link.classList.toggle('completed', isComplete);
        });
    };

    jumpLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            var sectionId = link.getAttribute('data-section');
            var section = document.getElementById(sectionId);
            if (!section) return;

            var top = section.getBoundingClientRect().top + window.pageYOffset - getStickyOffset();
            window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
            setActive(sectionId);

            section.classList.remove('jump-flash');
            // Force reflow so repeated clicks retrigger the animation.
            void section.offsetWidth;
            section.classList.add('jump-flash');

            window.setTimeout(function () {
                section.classList.remove('jump-flash');
            }, 1000);
        });
    });

    var form = document.getElementById('addVehicleForm');
    if (form) {
        form.addEventListener('input', updateCompletion);
        form.addEventListener('change', updateCompletion);
    }

    window.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    updateCompletion();
    updateActiveFromScroll();
}

function initConditionRowButtons() {
    var addButtons = document.querySelectorAll('[data-add-row]');
    addButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var targetId = button.getAttribute('data-add-row');
            var target = document.getElementById(targetId);
            if (!target) return;

            var firstRow = target.querySelector('.condition-row');
            if (!firstRow) return;

            var cloned = firstRow.cloneNode(true);
            var fields = cloned.querySelectorAll('select');
            fields.forEach(function (field) {
                field.selectedIndex = 0;
            });
            target.appendChild(cloned);
        });
    });
}

function initKeyRowButtons() {
    var addButton = document.querySelector('[data-add-key-row]');
    if (!addButton) return;

    addButton.addEventListener('click', function () {
        var targetId = addButton.getAttribute('data-add-key-row');
        var target = document.getElementById(targetId);
        if (!target) return;

        var firstRow = target.querySelector('.keys-row');
        if (!firstRow) return;

        var cloned = firstRow.cloneNode(true);
        var fields = cloned.querySelectorAll('select');
        fields.forEach(function (field) {
            field.selectedIndex = 0;
        });
        target.appendChild(cloned);
    });
}

function initEquipmentCheckAll() {
    var checkAll = document.getElementById('equipmentCheckAll');
    if (!checkAll) return;

    var equipmentChecks = document.querySelectorAll('input[name="equipment[]"]');
    checkAll.addEventListener('change', function () {
        equipmentChecks.forEach(function (checkbox) {
            checkbox.checked = checkAll.checked;
        });
    });
}

function initAnnouncementCounter() {
    var textarea = document.getElementById('additionalAnnouncements');
    var remaining = document.getElementById('announcementCharsRemaining');
    if (!textarea || !remaining) return;

    var maxLength = parseInt(textarea.getAttribute('maxlength') || '2000', 10);
    var update = function () {
        var remainingCount = maxLength - textarea.value.length;
        remaining.textContent = String(remainingCount);
    };

    textarea.addEventListener('input', update);
    update();
}

function initPhotoPreview() {
    var input = document.getElementById('vehiclePhotos');
    var grid = document.getElementById('photoGrid');
    if (!input || !grid) return;

    input.addEventListener('change', function () {
        grid.innerHTML = '';
        var files = Array.prototype.slice.call(input.files || []);

        files.forEach(function (file) {
            if (!file.type.startsWith('image/')) {
                return;
            }

            var tile = document.createElement('div');
            tile.className = 'photo-tile';

            var img = document.createElement('img');
            img.alt = file.name;
            img.src = URL.createObjectURL(file);

            img.addEventListener('load', function () {
                URL.revokeObjectURL(img.src);
            });

            tile.appendChild(img);
            grid.appendChild(tile);
        });
    });
}

function initListingDurationPreview() {
    var startNow = document.getElementById('startNow');
    var startDate = document.getElementById('listingStartDate');
    var startTime = document.getElementById('listingStartTime');
    var timezone = document.getElementById('listingTimezone');
    var duration = document.getElementById('listingDuration');
    var preview = document.getElementById('listingEndPreview');
    if (!startDate || !duration || !preview) return;

    duration.value = '1';
    duration.disabled = true;
    duration.title = 'Active auctions run for 24 hours from the selected start time.';

    var toggleStartInputs = function () {
        var shouldDisable = !!(startNow && startNow.checked);
        startDate.disabled = shouldDisable;
        if (startTime) startTime.disabled = shouldDisable;
        if (timezone) timezone.disabled = shouldDisable;
    };

    var updatePreview = function () {
        var auctionWindow = deriveAuctionWindowFromInputs(startNow, startDate, startTime, timezone);
        if (!auctionWindow) {
            preview.value = 'End date preview';
            return;
        }

        preview.value = auctionWindow.end.toLocaleString();
    };

    if (startNow) {
        startNow.addEventListener('change', function () {
            toggleStartInputs();
            updatePreview();
        });
    }
    startDate.addEventListener('change', updatePreview);
    if (startTime) {
        startTime.addEventListener('change', updatePreview);
    }
    if (timezone) {
        timezone.addEventListener('change', updatePreview);
    }

    toggleStartInputs();
    updatePreview();
}

function deriveAuctionWindowFromInputs(startNow, startDate, startTime, timezone) {
    var start;

    if (startNow && startNow.checked) {
        start = new Date();
    } else {
        if (!startDate || !startDate.value) {
            return null;
        }

        var dateParts = startDate.value.split('-');
        if (dateParts.length !== 3) {
            return null;
        }

        var year = parseInt(dateParts[0], 10);
        var month = parseInt(dateParts[1], 10);
        var day = parseInt(dateParts[2], 10);

        var rawTime = startTime && startTime.value ? startTime.value : '00:00';
        var timeParts = rawTime.split(':');
        if (timeParts.length < 2) {
            return null;
        }

        var hour = parseInt(timeParts[0], 10);
        var minute = parseInt(timeParts[1], 10);

        if ([year, month, day, hour, minute].some(Number.isNaN)) {
            return null;
        }

        var tzKey = timezone && timezone.value ? timezone.value : 'ET';
        var timezoneOffsets = {
            ET: -5,
            CT: -6,
            MT: -7,
            PT: -8
        };
        var offset = Object.prototype.hasOwnProperty.call(timezoneOffsets, tzKey) ? timezoneOffsets[tzKey] : -5;

        var startUtcMs = Date.UTC(year, month - 1, day, hour - offset, minute, 0, 0);
        start = new Date(startUtcMs);
    }

    if (Number.isNaN(start.getTime())) {
        return null;
    }

    var end = new Date(start.getTime() + (24 * 60 * 60 * 1000));
    return {
        start: start,
        end: end
    };
}

function deriveAuctionWindowFromFormData(formData) {
    var startNow = formData.get('startNow');
    var startDateValue = formData.get('listingStartDate');
    var startTimeValue = formData.get('listingStartTime');
    var timezoneValue = formData.get('listingTimezone');

    var startDate = { value: startDateValue || '' };
    var startTime = { value: startTimeValue || '' };
    var timezone = { value: timezoneValue || '' };
    var windowRange = deriveAuctionWindowFromInputs({ checked: !!startNow }, startDate, startTime, timezone);
    if (!windowRange) {
        return null;
    }

    return {
        startAt: windowRange.start.toISOString(),
        endAt: windowRange.end.toISOString()
    };
}

function serializeFormData(formData) {
    var data = {};

    formData.forEach(function (value, key) {
        if (key.slice(-2) === '[]') {
            var normalizedKey = key.slice(0, -2);
            if (!Array.isArray(data[normalizedKey])) {
                data[normalizedKey] = [];
            }
            data[normalizedKey].push(value);
            return;
        }

        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
            return;
        }

        data[key] = value;
    });

    return data;
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
