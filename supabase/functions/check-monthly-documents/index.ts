const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DocumentStatus {
  category: string;
  hasFiles: boolean;
  fileCount: number;
}

interface DozentDocumentStatus {
  dozentId: string;
  dozentName: string;
  dozentEmail: string;
  documentStatus: DocumentStatus[];
  missingDocuments: string[];
  receivedDocuments: string[];
}

interface ReminderEmailData {
  dozentName: string;
  dozentEmail: string;
  missingDocuments: string[];
  receivedDocuments: string[];
  previousMonth: string;
  previousYear: number;
  deadline: string;
  portalUrl: string;
}

const getDetailedReminderEmailTemplate = (data: ReminderEmailData): string => {
  const receivedSection = data.receivedDocuments.length > 0 ? `
    <div class="received-documents">
      <h4>✅ Bereits eingegangene Dokumente:</h4>
      <ul>
        ${data.receivedDocuments.map(doc => `<li><strong>${doc}</strong> - Vielen Dank!</li>`).join('')}
      </ul>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erinnerung: Dokumenten-Deadline ${data.previousMonth} ${data.previousYear}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            background-color: #f2f5fa;
            color: #051920;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(5, 25, 32, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2a83bf 0%, #1e6b9a 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
        }
        
        .logo {
            position: relative;
            z-index: 2;
        }
        
        .logo h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        
        .logo p {
            color: #d3e5f3;
            font-size: 16px;
            font-weight: 400;
        }
        
        .content {
            padding: 50px 40px;
        }
        
        .notification-header {
            font-size: 24px;
            color: #051920;
            margin-bottom: 20px;
            font-weight: 600;
            text-align: center;
        }
        
        .message {
            font-size: 16px;
            color: #051920;
            margin-bottom: 25px;
            line-height: 1.7;
        }
        
        .deadline-notice {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 2px solid #ffc107;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
            position: relative;
        }
        
        .deadline-notice::before {
            content: '📅';
            font-size: 24px;
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: #fff3cd;
            padding: 0 10px;
        }
        
        .deadline-notice h3 {
            color: #856404;
            font-size: 18px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .deadline-notice p {
            color: #856404;
            font-size: 16px;
            margin: 0;
            font-weight: 600;
        }
        
        .received-documents {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
        }
        
        .received-documents h4 {
            color: #155724;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
            display: flex;
            align-items: center;
        }
        
        .received-documents ul {
            list-style: none;
            padding: 0;
        }
        
        .received-documents li {
            background-color: #ffffff;
            border: 1px solid #c3e6cb;
            border-radius: 6px;
            padding: 12px 15px;
            margin: 8px 0;
            display: flex;
            align-items: center;
            font-weight: 500;
            color: #155724;
        }
        
        .received-documents li::before {
            content: '✅';
            margin-right: 12px;
            font-size: 16px;
        }
        
        .missing-documents {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
        }
        
        .missing-documents h4 {
            color: #dc3545;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
            display: flex;
            align-items: center;
        }
        
        .missing-documents h4::before {
            content: '📋';
            margin-right: 10px;
        }
        
        .document-list {
            list-style: none;
            padding: 0;
        }
        
        .document-list li {
            background-color: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 12px 15px;
            margin: 8px 0;
            display: flex;
            align-items: center;
            font-weight: 500;
            color: #495057;
        }
        
        .document-list li::before {
            content: '❌';
            margin-right: 12px;
            font-size: 16px;
        }
        
        .action-button {
            display: inline-block;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 18px 36px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            margin: 25px 0 35px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }
        
        .button-center {
            text-align: center;
        }
        
        .instructions {
            background-color: #e7f3ff;
            border: 1px solid #b3d9ff;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        
        .instructions h4 {
            color: #0056b3;
            font-size: 16px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        
        .instructions ol {
            color: #0056b3;
            font-size: 14px;
            padding-left: 20px;
        }
        
        .instructions li {
            margin: 8px 0;
            line-height: 1.5;
        }
        
        .footer {
            background-color: #f2f5fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #d3e5f3;
        }
        
        .footer p {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .contact-info {
            color: #2a83bf;
            font-size: 14px;
        }
        
        .security-note {
            font-size: 12px;
            color: #666;
            margin-top: 20px;
            font-style: italic;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 8px;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .logo h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 30px 25px;
            }
            
            .notification-header {
                font-size: 20px;
            }
            
            .footer {
                padding: 25px 20px;
            }
            
            .missing-documents,
            .received-documents,
            .deadline-notice {
                padding: 20px;
            }
            
            .action-button {
                padding: 16px 24px;
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">
                <h1>Kraatz Group</h1>
                <p>Dozentenportal</p>
            </div>
        </div>
        
        <div class="content">
            <h2 class="notification-header">📅 Monatliche Dokumenten-Erinnerung</h2>
            
            <p class="message">Liebe/r ${data.dozentName},</p>
            
            <p class="message">
                heute ist der 5. des Monats und damit die Deadline für die Einreichung der Dokumente 
                für <strong>${data.previousMonth} ${data.previousYear}</strong>. Wir führen unsere 
                monatliche Überprüfung durch und möchten Sie über den Status Ihrer Unterlagen informieren.
            </p>
            
            <div class="deadline-notice">
                <h3>Deadline: 5. des Folgemonats</h3>
                <p>Alle Dokumente müssen bis zum 5. des Folgemonats eingereicht werden</p>
            </div>
            
            ${receivedSection}
            
            ${data.missingDocuments.length > 0 ? `
            <div class="missing-documents">
                <h4>Noch ausstehende Dokumente:</h4>
                <ul class="document-list">
                    ${data.missingDocuments.map(doc => `<li>${doc}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${data.missingDocuments.length > 0 ? `
            <p class="message">
                <strong>Wichtiger Hinweis:</strong> Die vollständige und rechtzeitige Übermittlung 
                aller erforderlichen Dokumente ist für die ordnungsgemäße Abrechnung und 
                Dokumentation Ihrer Dozententätigkeit unerlässlich.
            </p>
            
            <div class="button-center">
                <a href="${data.portalUrl}/dashboard" class="action-button">Jetzt Dokumente hochladen</a>
            </div>
            
            <div class="instructions">
                <h4>So laden Sie Ihre Dokumente hoch:</h4>
                <ol>
                    <li>Loggen Sie sich in das Dozentenportal ein</li>
                    <li>Wählen Sie den entsprechenden Ordner aus (Rechnungen, Tätigkeitsbericht, etc.)</li>
                    <li>Klicken Sie auf "Datei hochladen"</li>
                    <li>Wählen Sie Ihre Datei aus und bestätigen Sie den Upload</li>
                    <li>Überprüfen Sie, dass alle erforderlichen Dokumente vollständig sind</li>
                </ol>
            </div>
            ` : `
            <p class="message">
                <strong>Herzlichen Glückwunsch!</strong> Alle erforderlichen Dokumente für 
                ${data.previousMonth} ${data.previousYear} sind vollständig eingegangen. 
                Vielen Dank für Ihre pünktliche und vollständige Dokumentation!
            </p>
            `}
            
            <p class="message">
                Bei Fragen oder technischen Problemen stehen wir Ihnen gerne zur Verfügung. 
                Kontaktieren Sie uns einfach über das Nachrichtensystem im Portal oder per E-Mail.
            </p>
            
            <p class="message">
                Mit freundlichen Grüßen<br>
                <strong>Ihr Kraatz Group Team</strong><br>
                Akademie Kraatz GmbH
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Akademie Kraatz GmbH</strong></p>
            <p>Wilmersdorfer Str. 145/146 – 10585 Berlin</p>
            <div class="contact-info">
                <p>📞 030 756 573 97</p>
                <p>📧 info@kraatz-group.de</p>
                <p>🌐 www.kraatz-group.de</p>
            </div>
            
            <p class="security-note">
                Diese E-Mail wurde automatisch am 5. des Monats generiert. 
                Bei Rückfragen antworten Sie bitte direkt auf diese E-Mail oder nutzen Sie das Nachrichtensystem im Portal.
            </p>
        </div>
    </div>
</body>
</html>`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getMonthName = (monthNumber: number): string => {
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  return months[monthNumber - 1] || 'Unbekannt';
};

const getPreviousMonth = () => {
  const now = new Date();
  const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { month: previousMonth, year: previousYear };
};

const getDeadline = (): string => {
  const today = new Date();
  return formatDate(today.toISOString());
};

// Function to send email using Resend API
const sendEmailViaResend = async (to: string, subject: string, html: string) => {
  console.log('📧 sendEmailViaResend called with:', { to, subject: subject.substring(0, 50) + '...' });
  
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    console.error('❌ RESEND_API_KEY environment variable is not set');
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  console.log('✅ Resend API key found');
  
  const emailPayload = {
    from: 'Dozentenportal | Kraatz Group <dozentenportal@kraatz-group.de>',
    to: [to],
    subject: subject,
    html: html,
  };
  console.log('📧 Email payload prepared:', { ...emailPayload, html: 'HTML_CONTENT_TRUNCATED' });
  
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
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Resend API error response:', errorText);
    throw new Error(`Resend API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Resend API success response:', result);
  return result;
};

Deno.serve(async (req) => {
  console.log('🚀 check-monthly-documents function started');
  console.log('📥 Request method:', req.method);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📦 Importing Supabase client...');
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    
    console.log('🔗 Creating Supabase client...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if today is the 5th of the month
    const today = new Date();
    const isDeadlineDay = today.getDate() === 5;
    
    console.log('📅 Today is:', today.toISOString().split('T')[0]);
    console.log('📅 Is deadline day (5th):', isDeadlineDay);

    // For testing purposes, allow manual execution
    const { forceCheck } = await req.json().catch(() => ({ forceCheck: false }));
    
    if (!isDeadlineDay && !forceCheck) {
      console.log('⏭️ Not deadline day and not forced - skipping check');
      return new Response(
        JSON.stringify({ 
          message: 'Document check only runs on the 5th of each month',
          today: today.toISOString().split('T')[0],
          nextCheck: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-05`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Starting monthly document check...');
    
    // Get previous month details
    const { month: previousMonth, year: previousYear } = getPreviousMonth();
    console.log('📅 Checking documents for:', getMonthName(previousMonth), previousYear);

    // Get all dozenten (non-admin users)
    console.log('👥 Fetching all dozenten...');
    const { data: dozenten, error: dozentenError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'dozent');

    if (dozentenError) {
      console.error('❌ Error fetching dozenten:', dozentenError);
      throw dozentenError;
    }
    console.log('✅ Found', dozenten?.length || 0, 'dozenten');

    const requiredCategories = ['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer'];
    const results: DozentDocumentStatus[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    // Check each dozent's documents
    for (const dozent of dozenten || []) {
      console.log('🔍 Checking documents for:', dozent.full_name);
      
      const documentStatus: DocumentStatus[] = [];
      const missingDocuments: string[] = [];
      const receivedDocuments: string[] = [];

      // Get dozent's folders
      const { data: folders, error: foldersError } = await supabaseClient
        .from('folders')
        .select('id, name')
        .eq('user_id', dozent.id)
        .in('name', requiredCategories);

      if (foldersError) {
        console.error(`❌ Error fetching folders for ${dozent.full_name}:`, foldersError);
        continue;
      }

      // Check each required category
      for (const category of requiredCategories) {
        const folder = folders?.find(f => f.name === category);
        
        if (!folder) {
          console.log(`📁 No folder found for category: ${category}`);
          documentStatus.push({
            category,
            hasFiles: false,
            fileCount: 0
          });
          missingDocuments.push(category);
          continue;
        }

        // Check for files in this folder for the previous month
        const { data: files, error: filesError } = await supabaseClient
          .from('files')
          .select('id, name')
          .eq('folder_id', folder.id)
          .eq('assigned_month', previousMonth)
          .eq('assigned_year', previousYear);

        if (filesError) {
          console.error(`❌ Error checking files for ${category}:`, filesError);
          continue;
        }

        const hasFiles = files && files.length > 0;
        const fileCount = files?.length || 0;

        documentStatus.push({
          category,
          hasFiles,
          fileCount
        });

        if (hasFiles) {
          receivedDocuments.push(`${category} (${fileCount} ${fileCount === 1 ? 'Datei' : 'Dateien'})`);
        } else {
          missingDocuments.push(category);
        }

        console.log(`📊 ${category}: ${hasFiles ? '✅' : '❌'} (${fileCount} files)`);
      }

      const dozentStatus: DozentDocumentStatus = {
        dozentId: dozent.id,
        dozentName: dozent.full_name,
        dozentEmail: dozent.email,
        documentStatus,
        missingDocuments,
        receivedDocuments
      };

      results.push(dozentStatus);

      // Send reminder email (always send, but content varies based on status)
      console.log('📧 Preparing reminder email for:', dozent.full_name);
      
      const portalUrl = Deno.env.get('SITE_URL') || 'http://portal.kraatz-group.de';
      
      const emailData: ReminderEmailData = {
        dozentName: dozent.full_name,
        dozentEmail: dozent.email,
        missingDocuments,
        receivedDocuments,
        previousMonth: getMonthName(previousMonth),
        previousYear,
        deadline: getDeadline(),
        portalUrl
      };

      const emailHtml = getDetailedReminderEmailTemplate(emailData);
      const subject = missingDocuments.length > 0 
        ? `📋 Dokumenten-Deadline: Noch ${missingDocuments.length} Dokument(e) ausstehend für ${emailData.previousMonth} ${emailData.previousYear}`
        : `✅ Dokumenten-Status: Alle Unterlagen für ${emailData.previousMonth} ${emailData.previousYear} vollständig`;

      try {
        console.log('📤 Sending reminder email to:', dozent.email);
        const result = await sendEmailViaResend(dozent.email, subject, emailHtml);
        console.log(`✅ Email sent successfully to ${dozent.email} (ID: ${result.id})`);
        emailsSent++;
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${dozent.email}:`, emailError);
        emailsFailed++;
      }
    }

    console.log('📊 Monthly document check completed');
    console.log(`📧 Emails sent: ${emailsSent}, failed: ${emailsFailed}`);

    const summary = {
      checkDate: today.toISOString().split('T')[0],
      previousMonth: getMonthName(previousMonth),
      previousYear,
      totalDozenten: dozenten?.length || 0,
      emailsSent,
      emailsFailed,
      results: results.map(r => ({
        dozentName: r.dozentName,
        dozentEmail: r.dozentEmail,
        missingCount: r.missingDocuments.length,
        receivedCount: r.receivedDocuments.length,
        missingDocuments: r.missingDocuments,
        receivedDocuments: r.receivedDocuments
      }))
    };

    console.log('📤 Sending summary response:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error in check-monthly-documents function:', error);
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