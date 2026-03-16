// report.js - COMPLETE WORKING VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('Report page loaded');
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    console.log('QR code parameter:', code);

    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const form = document.getElementById('qr-report-form');

    if (!code) {
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'No item code provided. Please scan a valid QR code.';
        return;
    }

    // Fetch item data
    fetch(`/api/item/${code}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Item not found');
            }
            return response.json();
        })
        .then(item => {
            console.log('Item data received:', item);

            // Fill form
            document.getElementById('item_code').value = code;
            document.getElementById('item_name').value = (item.item_name || '') + (item.description ? ' - ' + item.description : '');
            document.getElementById('owner_name').value = item.owner_name || '';
            document.getElementById('owner_email').value = item.owner_email || '';

            loadingDiv.style.display = 'none';
            form.style.display = 'block';
        })
        .catch(err => {
            console.error('Error fetching item:', err);
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Item not found. Please check the QR code.';
        });

    // Handle form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(form);
        const ownerEmail = document.getElementById('owner_email').value;
        const location = formData.get('location');
        const notes = formData.get('notes');
        const photoFile = document.getElementById('photo').files[0];
        const submitBtn = form.querySelector('button[type="submit"]');

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        // Try to send email if EmailJS is available
        if (typeof emailjs !== 'undefined') {
            sendEmail(ownerEmail, location, notes, submitBtn, formData, code, photoFile);
        } else {
            console.warn('EmailJS not available, saving report only');
            saveReport(formData, code, photoFile, submitBtn);
        }
    });
});

// Function to send email
function sendEmail(ownerEmail, location, notes, submitBtn, formData, code, photoFile) {
    console.log('Attempting to send email...');
    
    const templateParams = {
        to_email: ownerEmail,
        from_name: 'HMA Smart‑Find',
        location: location,
        notes: notes || 'No additional notes'
    };

   emailjs.send(
    'service_ym11glb',     // <-- NEW Service ID
    'template_mgg9tjx',     // <-- NEW Template ID
    templateParams
)
        .then(function(response) {
            console.log('✅ Email sent successfully!', response);
            showMessage('✅ Email sent to owner!', 'success');
        })
        .catch(function(err) {
            console.error('❌ Email error:', err);
            showMessage('⚠️ Email failed, but report will be saved', 'warning');
        })
        .finally(function() {
            // Always save report, even if email fails
            saveReport(formData, code, photoFile, submitBtn);
        });
}

// Function to save report
function saveReport(formData, code, photoFile, submitBtn) {
    console.log('Saving report...');
    
    const reportFormData = new FormData();
    reportFormData.append('item_code', code);
    reportFormData.append('location', formData.get('location'));
    reportFormData.append('finder_name', formData.get('finder_name') || 'Anonymous');
    reportFormData.append('notes', formData.get('notes') || '');
    if (photoFile) reportFormData.append('photo', photoFile);

    fetch('/api/report', {
        method: 'POST',
        body: reportFormData
    })
    .then(response => {
        if (response.ok) {
            console.log('✅ Report saved successfully');
            showMessage('✅ Report saved! Redirecting...', 'success');
            
            // Redirect to discover page after 2 seconds
            setTimeout(function() {
                window.location.href = '/discover.html';
            }, 2000);
        } else {
            throw new Error('Failed to save report');
        }
    })
    .catch(err => {
        console.error('❌ Save error:', err);
        showMessage('❌ Error saving report', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Notification';
    });
}

// Helper function to show messages
function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-${type}`;
    messageDiv.textContent = text;
    
    const form = document.getElementById('qr-report-form');
    form.parentNode.insertBefore(messageDiv, form);
    
    if (type === 'success') {
        form.style.display = 'none';
    }
}