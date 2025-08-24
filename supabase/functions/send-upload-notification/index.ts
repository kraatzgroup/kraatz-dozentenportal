import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { render } from 'https://esm.sh/@react-email/render@0.0.7'
import React from 'https://esm.sh/react@18.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailData {
  dozentName: string;
  dozentEmail: string;
  documentName: string;
  fileSize: string;
  uploadDate: string;
  documentCategory: string;
  adminPortalUrl: string;
}

// React Email Template Component
const DocumentUploadNotification = ({ 
  dozentName, 
  dozentEmail, 
  documentName, 
  fileSize, 
  uploadDate, 
  documentCategory, 
  adminPortalUrl 
}: EmailData) => {
  return React.createElement('div', {
    style: {
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(5, 25, 32, 0.1)',
      overflow: 'hidden'
    }
  }, [
    // Header
    React.createElement('div', {
      key: 'header',
      style: {
        backgroundColor: '#2a83bf',
        padding: '40px 30px',
        textAlign: 'center',
        color: '#ffffff'
      }
    }, [
      React.createElement('h1', {
        key: 'title',
        style: { fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }
      }, 'Kraatz Group'),
      React.createElement('p', {
        key: 'subtitle',
        style: { fontSize: '16px', margin: '0', color: '#d3e5f3' }
      }, 'Dozentenportal - Admin')
    ]),
    
    // Content
    React.createElement('div', {
      key: 'content',
      style: { padding: '50px 40px' }
    }, [
      React.createElement('h2', {
        key: 'heading',
        style: { fontSize: '24px', color: '#051920', marginBottom: '20px', textAlign: 'center' }
      }, '📄 Neues Dokument hochgeladen'),
      
      React.createElement('p', {
        key: 'intro',
        style: { fontSize: '16px', color: '#051920', marginBottom: '25px', lineHeight: '1.7' }
      }, 'Ein Dozent hat ein neues Dokument im Dozentenportal hochgeladen, das möglicherweise Ihre Aufmerksamkeit erfordert.'),
      
      // Info Box
      React.createElement('div', {
        key: 'infobox',
        style: {
          backgroundColor: '#d3e5f3',
          borderLeft: '4px solid #2a83bf',
          padding: '25px',
          margin: '30px 0',
          borderRadius: '0 8px 8px 0'
        }
      }, [
        React.createElement('h3', {
          key: 'infotitle',
          style: { color: '#2a83bf', fontSize: '18px', marginBottom: '15px' }
        }, 'Dokument-Details'),
        React.createElement('p', { key: 'dozent', style: { margin: '10px 0', fontSize: '14px' } }, `Dozent: ${dozentName}`),
        React.createElement('p', { key: 'email', style: { margin: '10px 0', fontSize: '14px' } }, `E-Mail: ${dozentEmail}`),
        React.createElement('p', { key: 'filename', style: { margin: '10px 0', fontSize: '14px' } }, `Dateiname: ${documentName}`),
        React.createElement('p', { key: 'filesize', style: { margin: '10px 0', fontSize: '14px' } }, `Dateigröße: ${fileSize}`),
        React.createElement('p', { key: 'date', style: { margin: '10px 0', fontSize: '14px' } }, `Hochgeladen am: ${uploadDate}`),
        React.createElement('p', { key: 'category', style: { margin: '10px 0', fontSize: '14px' } }, `Kategorie: ${documentCategory}`)
      ]),
      
      // Button
      React.createElement('div', {
        key: 'buttoncontainer',
        style: { textAlign: 'center', margin: '30px 0' }
      }, [
        React.createElement('a', {
          key: 'button',
          href: adminPortalUrl,
          style: {
            backgroundColor: '#2a83bf',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '16px 32px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            display: 'inline-block'
          }
        }, 'Zum Admin-Portal')
      ]),
      
      React.createElement('p', {
        key: 'outro',
        style: { fontSize: '16px', color: '#051920', marginBottom: '25px', lineHeight: '1.7' }
      }, 'Sie können das Dokument im Admin-Bereich einsehen, herunterladen und bei Bedarf den Status ändern oder Rückmeldungen an den Dozenten senden.')
    ]),
    
    // Footer
    React.createElement('div', {
      key: 'footer',
      style: {
        backgroundColor: '#f2f5fa',
        padding: '30px 40px',
        textAlign: 'center',
        borderTop: '1px solid #d3e5f3'
      }
    }, [
      React.createElement('p', {
        key: 'company',
        style: { color: '#666', fontSize: '14px', marginBottom: '10px' }
      }, 'Akademie Kraatz GmbH | Wilmersdorfer Str. 145/146 – 10585 Berlin'),
      React.createElement('p', {
        key: 'contact',
        style: { color: '#2a83bf', fontSize: '14px', marginBottom: '10px' }
      }, '📞 030 756 573 97 | 📧 info@kraatz-group.de | 🌐 www.kraatz-group.de'),
      React.createElement('p', {
        key: 'note',
        style: { fontSize: '12px', color: '#666', marginTop: '20px', fontStyle: 'italic' }
      }, 'Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.')
    ])
  ]);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Function to send email using Resend API
const sendEmailViaResend = async (to: string, subject: string, html: string) => {
  console.log('📧 sendEmailViaResend called with:', { to, subject: subject.substring(0, 50) + '...' });
  
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY environment variable is not set');
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  console.log('✅ Resend API key found:', resendApiKey.substring(0, 10) + '...');
  
  const emailPayload = {
    from: 'Dozentenportal | Kraatz Group <dozentenportal@kraatz-group.de>',
    to: [to],
    subject: subject,
    html: html,
  };
  console.log('📧 Email payload prepared:', { 
    from: emailPayload.from,
    to: emailPayload.to,
    subject: emailPayload.subject,
    htmlLength: html.length
  });
  
  console.log('🌐 Making request to Resend API...');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  console.log('📡 Resend API response status:', response.status);
  console.log('📡 Resend API response headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Resend API error response:', errorText);
    throw new Error(`Resend API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Resend API success response:', result);
  return result;
};

serve(async (req) => {
  console.log('🚀 send-upload-notification function started');
  console.log('📥 Request method:', req.method);
  console.log('📥 Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔗 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('📋 Parsing request body...');
    const { fileId, uploadedBy, fileName, fileSize, folderId } = await req.json();
    console.log('📋 Request data:', { fileId, uploadedBy, fileName, fileSize, folderId });

    // Get file details and related information
    console.log('🔍 Fetching file data for fileId:', fileId);
    const { data: fileData, error: fileError } = await supabaseClient
      .from('files')
      .select(`
        *,
        folder:folders(name),
        uploaded_by_profile:profiles!files_uploaded_by_fkey(full_name, email)
      `)
      .eq('id', fileId)
      .single();

    if (fileError) {
      console.error('❌ Error fetching file data:', fileError);
      throw fileError;
    }
    console.log('✅ File data fetched successfully:', fileData);

    // Get all admin users
    console.log('👥 Fetching admin users...');
    const { data: admins, error: adminError } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('role', 'admin');

    if (adminError) {
      console.error('❌ Error fetching admins:', adminError);
      throw adminError;
    }
    console.log('✅ Admin users fetched:', admins?.length || 0, 'admins found');

    if (!admins || admins.length === 0) {
      console.log('⚠️ No admin users found - no notifications to send');
      return new Response(
        JSON.stringify({ message: 'No admin users to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare email data
    console.log('📧 Preparing email data...');
    const adminPortalUrl = Deno.env.get('SITE_URL') || 'http://portal.kraatz-group.de';
    console.log('🌐 Portal URL:', adminPortalUrl);
    
    const emailData: EmailData = {
      dozentName: fileData.uploaded_by_profile.full_name,
      dozentEmail: fileData.uploaded_by_profile.email,
      documentName: fileName,
      fileSize: formatFileSize(fileSize || 0),
      uploadDate: formatDate(fileData.created_at),
      documentCategory: fileData.folder.name,
      adminPortalUrl: `${adminPortalUrl}/admin`
    };
    console.log('📧 Email data prepared:', emailData);

    // Generate email HTML using React Email
    console.log('📧 Rendering React Email template...');
    const emailHtml = render(React.createElement(DocumentUploadNotification, emailData));
    const subject = `📄 Neues Dokument hochgeladen - ${fileData.folder.name}`;
    console.log('📧 Email subject:', subject);
    console.log('📧 Email HTML length:', emailHtml.length);

    // Send email to each admin using Resend API
    console.log('📤 Starting email sending process to', admins.length, 'admin(s)...');
    const emailPromises = admins.map(async (admin) => {
      console.log('📤 Preparing email for admin:', admin.email);
      
      try {
        console.log('📤 Sending email to:', admin.email);
        const result = await sendEmailViaResend(admin.email, subject, emailHtml);
        console.log('✅ Email sent successfully to:', admin.email, 'Email ID:', result.id);
        return { success: true, email: admin.email, emailId: result.id };
      } catch (error) {
        console.error(`❌ Failed to send email to ${admin.email}:`, error);
        return { success: false, email: admin.email, error: error.message };
      }
    });

    console.log('⏳ Waiting for all email promises to settle...');
    const results = await Promise.allSettled(emailPromises);
    console.log('📊 Email sending results:', results);
    
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failed = results.filter(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && !result.value.success)
    ).length;

    console.log(`📊 Email notifications summary: ${successful} successful, ${failed} failed`);
    
    const responseData = { 
      message: `Email notifications sent to ${successful} admin(s)`,
      successful,
      failed,
      details: results.map(result => 
        result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' }
      )
    };
    console.log('📤 Sending response:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error in send-upload-notification function:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});