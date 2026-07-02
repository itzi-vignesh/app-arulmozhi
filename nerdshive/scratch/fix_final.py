import os
import re

files_to_process = [
    'src/pages/Settings.tsx',
    'src/pages/Register.tsx',
    'src/components/ui/notification-bell.tsx',
    'src/components/ui/image-modal.tsx',
    'src/components/ui/forgot-password-modal.tsx',
    'src/components/PaymentVerificationTab.tsx',
    'src/components/CheckInApprovalTab.tsx',
    'src/components/BulkEnrollmentTab.tsx',
]

for file in files_to_process:
    if not os.path.exists(file): continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Settings.tsx specific fixes
    content = re.sub(r'const \{ error \} = await supabase\s*\n\s*\.from\(\'users\'\)\s*\n\s*\.update\(userUpdateData\)\s*\n\s*\.eq\(\'auth_id\', session\.user\.id\);', r"const { error } = await apiClient.put('/users/me', userUpdateData);", content)
    
    # Settings.tsx Storage Uploads
    storage_upload = '''const formData = new FormData();
        formData.append('file', newIdFile);
        const { data: uploadData, error: uploadError } = await apiClient.post(`/storage/id-proofs/${fileName}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });'''
    content = re.sub(r'const \{ data: uploadData, error: uploadError \} = await supabase\.storage\s*\n\s*\.from\(\'id-proofs\'\)\s*\n\s*\.upload\([^)]+\);', storage_upload, content)

    storage_upload_photo = '''const photoFormData = new FormData();
        photoFormData.append('file', newCustomerPhoto);
        const { data: photoUploadData, error: photoUploadError } = await apiClient.post(`/storage/customer-photos/${photoFileName}`, photoFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });'''
    content = re.sub(r'const \{ data: photoUploadData, error: photoUploadError \} = await supabase\.storage\s*\n\s*\.from\(\'customer-photos\'\)\s*\n\s*\.upload\([^)]+\);', storage_upload_photo, content)

    # Register.tsx Storage Uploads
    reg_storage_upload = '''const formData = new FormData();
          formData.append('file', idFile);
          const { data: uploadData, error: uploadError } = await apiClient.post(`/storage/id-proofs/${fileName}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });'''
    content = re.sub(r'const \{ data: uploadData, error: uploadError \} = await supabase\.storage\s*\n\s*\.from\(\'id-proofs\'\)\s*\n\s*\.upload\([^)]+\);', reg_storage_upload, content)

    reg_storage_upload_photo = '''const photoFormData = new FormData();
          photoFormData.append('file', photoFile);
          const { data: photoUploadData, error: photoUploadError } = await apiClient.post(`/storage/customer-photos/${photoFileName}`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });'''
    content = re.sub(r'const \{ data: photoUploadData, error: photoUploadError \} = await supabase\.storage\s*\n\s*\.from\(\'customer-photos\'\)\s*\n\s*\.upload\([^)]+\);', reg_storage_upload_photo, content)

    # getSignedUrl in Settings.tsx & image-modal.tsx
    get_signed = '''const { data } = await apiClient.get(`/storage/${bucket}/${path}`);
      return data;'''
    content = re.sub(r'const \{ data, error \} = await supabase\.storage\s*\n\s*\.from\(bucket\)\s*\n\s*\.createSignedUrl\(path, 3600\);', get_signed, content)

    # notification-bell.tsx channel
    bell_poll = '''    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };'''
    content = re.sub(r'const channel = supabase[\s\S]*?\.subscribe\(\);\s*return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};', bell_poll, content)

    # PaymentVerificationTab.tsx channel & db
    pay_poll = '''    const pollInterval = setInterval(() => {
      fetchPayments();
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };'''
    content = re.sub(r'const channel = supabase[\s\S]*?\.subscribe\(\);\s*return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};', pay_poll, content)
    
    pay_db = '''const { error } = await apiClient.put(`/payments/${paymentId}`, { status });'''
    content = re.sub(r'const \{ error \} = await supabase\s*\n\s*\.from\(\'payments\'\)\s*\n\s*\.update\(\{ status \}\)\s*\n\s*\.eq\(\'id\', paymentId\);', pay_db, content)

    # CheckInApprovalTab.tsx channel
    checkin_poll = '''    const pollInterval = setInterval(() => {
      fetchCheckins();
    }, 30000);

    return () => {
      clearInterval(pollInterval);
    };'''
    content = re.sub(r'const channel = supabase[\s\S]*?\.subscribe\(\);\s*return \(\) => \{\s*supabase\.removeChannel\(channel\);\s*\};', checkin_poll, content)

    # forgot-password-modal.tsx
    content = re.sub(r'const \{ error \} = await supabase\.auth\.resetPasswordForEmail[\s\S]*?\n\s*\n\s*if \(error\)', "const { error } = await apiClient.post('/auth/password-recovery', { email: email.trim() });\n\n      if (error)", content)

    # BulkEnrollmentTab.tsx url
    content = content.replace('`https://mwqehuxqldnxadnmopfn.supabase.co/functions/v1/bulk-enroll-users`', '`${import.meta.env.VITE_API_URL || \'http://localhost:8000/api/v1\'}/users/bulk-enroll`')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
