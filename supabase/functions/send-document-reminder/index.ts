const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReminderEmailData {
  dozentName: string;
  dozentEmail: string;
  missingDocuments: string[];
  previousMonth: string;
  previousYear: number;
  deadline: string;
  portalUrl: string;
  adminName: string;
}

const getReminderEmailTemplate = (data: ReminderEmailData): string => {
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erinnerung: Fehlende Dokumente</title>
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
            background-color: #2a83bf;
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
        
        .message-info {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 25px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .message-info h3 {
            color: #856404;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .document-list {
            background-color: #f8fbff;
            border: 1px solid #d3e5f3;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .document-list h4 {
            color: #2a83bf;
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .document-list ul {
            list-style-type: none;
            padding: 0;
        }
        
        .document-list li {
            color: #051920;
            font-size: 14px;
            line-height: 1.6;
            margin: 8px 0;
            padding-left: 20px;
            position: relative;
        }
        
        .document-list li::before {
            content: '📄';
            position: absolute;
            left: 0;
            top: 0;
        }
        
        .deadline-info {
            background-color: #f8d7da;
            border-left: 4px solid #dc3545;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .deadline-info h4 {
            color: #721c24;
            font-size: 16px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .deadline-info p {
            color: #721c24;
            font-size: 14px;
            margin: 0;
            font-weight: 500;
        }
        
        .action-button {
            display: inline-block;
            background-color: #2a83bf;
            color: #ffffff;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            margin: 20px 0 35px 0;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 15px rgba(42, 131, 191, 0.3);
        }
        
        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(42, 131, 191, 0.4);
        }
        
        .button-center {
            text-align: center;
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
            
            .message-info, .document-list, .deadline-info {
                padding: 20px;
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
            <h2 class="notification-header">Erinnerung: Fehlende Dokumente</h2>
            
            <p class="message">Liebe/r ${data.dozentName},</p>
            
            <p class="message">
                wir hoffen, Sie sind wohlauf. Bei der Überprüfung unserer Unterlagen ist uns aufgefallen, 
                dass für den Monat <strong>${data.previousMonth} ${data.previousYear}</strong> noch wichtige Dokumente von Ihnen fehlen.
            </p>
            
            <div class="message-info">
                <h3>⚠️ Benötigte Unterlagen</h3>
                <p>Um die ordnungsgemäße Abrechnung und Dokumentation sicherzustellen, benötigen wir 
                folgende Dokumente vollständig und fristgerecht.</p>
            </div>
            
            <div class="document-list">
                <h4>Noch ausstehende Dokumente:</h4>
                <ul>
                    ${data.missingDocuments.map(doc => `<li><strong>${doc}</strong></li>`).join('')}
                </ul>
            </div>
            
            <div class="deadline-info">
                <h4>🕒 Wichtiger Hinweis zur Frist</h4>
                <p>Bitte laden Sie alle fehlenden Dokumente bis <strong>${data.deadline}</strong> 
                in das System hoch. Eine spätere Einreichung kann zu Verzögerungen bei der 
                Bearbeitung und Auszahlung führen.</p>
            </div>
            
            <p class="message">
                Wir verstehen, dass es manchmal zu Verzögerungen kommen kann, und schätzen Ihre 
                kontinuierliche Zusammenarbeit sehr. Die rechtzeitige Einreichung aller Unterlagen 
                hilft uns dabei, Ihre Abrechnungen schnell und korrekt zu bearbeiten.
            </p>
            
            <div class="button-center">
                <a href="${data.portalUrl}/dashboard" class="action-button">Dokumente jetzt hochladen</a>
            </div>
            
            <p class="message">
                Falls Sie Fragen haben oder Unterstützung beim Upload benötigen, zögern Sie nicht, 
                sich an uns zu wenden. Wir stehen Ihnen gerne zur Verfügung.
            </p>
            
            <p class="message">
                Vielen Dank für Ihr Verständnis und Ihre prompte Bearbeitung.
            </p>
            
            <p class="message">
                Mit freundlichen Grüßen<br>
                <strong>${data.adminName}</strong><br>
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
                Diese E-Mail wurde automatisch generiert. 
                Bitte antworten Sie nicht direkt auf diese Nachricht.
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
  const deadline = new Date(today);
  deadline.setHours(23, 59, 59, 999); // End of today
  return formatDate(deadline.toISOString());
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

Deno.serve(async (req) => {
  console.log('🚀 send-document-reminder function started');
  console.log('📥 Request method:', req.method);
  console.log('📥 Request headers:', Object.fromEntries(req.headers.entries()));
  
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

    console.log('📋 Parsing request body...');
    const { dozentId, adminId } = await req.json();
    console.log('📋 Request data:', { dozentId, adminId });

    // Get dozent information
    console.log('🔍 Fetching dozent data for dozentId:', dozentId);
    const { data: dozentData, error: dozentError } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', dozentId)
      .single();

    if (dozentError) {
      console.error('❌ Error fetching dozent data:', dozentError);
      throw dozentError;
    }
    console.log('✅ Dozent data fetched successfully:', dozentData);

    // Get admin information
    console.log('🔍 Fetching admin data for adminId:', adminId);
    const { data: adminData, error: adminError } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('❌ Error fetching admin data:', adminError);
      throw adminError;
    }
    console.log('✅ Admin data fetched successfully:', adminData);

    // Get dozent's folders
    console.log('📁 Fetching dozent folders...');
    const { data: folders, error: foldersError } = await supabaseClient
      .from('folders')
      .select('id, name')
      .eq('user_id', dozentId)
      .in('name', ['Rechnungen', 'Tätigkeitsbericht', 'Aktive Teilnehmer']);

    if (foldersError) {
      console.error('❌ Error fetching folders:', foldersError);
      throw foldersError;
    }
    console.log('✅ Folders fetched successfully:', folders?.length || 0, 'folders found');

    // Always send reminder - no document checking
    console.log('📅 Calculating previous month...');
    const { month: previousMonth, year: previousYear } = getPreviousMonth();
    console.log('📅 Previous month:', previousMonth, 'Previous year:', previousYear);
    
    // Always include all folder types as "missing" for reminder purposes
    const missingDocuments = folders.map(folder => folder.name);
    console.log('📊 Sending reminder for all document types:', missingDocuments);

    // Prepare email data
    console.log('📧 Preparing email data...');
    const portalUrl = Deno.env.get('SITE_URL') || 'http://portal.kraatz-group.de';
    console.log('🌐 Portal URL:', portalUrl);
    
    const emailData: ReminderEmailData = {
      dozentName: dozentData.full_name,
      dozentEmail: dozentData.email,
      missingDocuments: missingDocuments,
      previousMonth: getMonthName(previousMonth),
      previousYear: previousYear,
      deadline: getDeadline(),
      portalUrl: portalUrl,
      adminName: adminData.full_name
    };
    console.log('📧 Email data prepared:', {
      ...emailData,
      missingDocuments: emailData.missingDocuments
    });

    // Generate email HTML
    console.log('📧 Generating email HTML...');
    const emailHtml = getReminderEmailTemplate(emailData);
    const subject = `⚠️ Erinnerung: Fehlende Dokumente für ${emailData.previousMonth} ${emailData.previousYear} - Kraatz Group Portal`;
    console.log('📧 Email subject:', subject);
    
    try {
      // Send email using Resend API
      console.log('📤 Sending reminder email to:', emailData.dozentEmail);
      const result = await sendEmailViaResend(emailData.dozentEmail, subject, emailHtml);
      
      console.log(`✅ Document reminder sent successfully to ${emailData.dozentEmail} (Email ID: ${result.id})`);

      const successResponse = { 
        message: 'Document reminder email sent successfully (no document check performed)',
        dozentName: emailData.dozentName,
        dozentEmail: emailData.dozentEmail,
        missingDocuments: emailData.missingDocuments,
        previousMonth: emailData.previousMonth,
        previousYear: emailData.previousYear,
        emailId: result.id
      };
      console.log('📤 Sending success response:', successResponse);
      
      return new Response(
        JSON.stringify(successResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError) {
      console.error(`❌ Failed to send reminder email to ${emailData.dozentEmail}:`, emailError);
      
      const errorResponse = { 
        error: 'Failed to send reminder email',
        emailError: emailError.message,
        dozentName: emailData.dozentName,
        missingDocuments: emailData.missingDocuments
      };
      console.log('📤 Sending error response:', errorResponse);
      
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('❌ Critical error in send-document-reminder function:', error);
    console.error('❌ Error stack:', error.stack);
    
    const criticalErrorResponse = { error: error.message };
    console.log('📤 Sending critical error response:', criticalErrorResponse);
    
    return new Response(
      JSON.stringify(criticalErrorResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});