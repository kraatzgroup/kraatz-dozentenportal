const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MessageEmailData {
  senderName: string;
  senderEmail: string;
  receiverName: string;
  receiverEmail: string;
  messageContent: string;
  sendDate: string;
  portalUrl: string;
}

const getMessageEmailTemplate = (data: MessageEmailData): string => {
  return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neue Nachricht - Kraatz Group Dozentenportal</title>
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
            background-color: #d3e5f3;
            border-left: 4px solid #2a83bf;
            padding: 25px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .message-info h3 {
            color: #2a83bf;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .info-row {
            display: flex;
            margin: 10px 0;
            font-size: 14px;
        }
        
        .info-label {
            font-weight: 600;
            color: #051920;
            min-width: 120px;
            flex-shrink: 0;
        }
        
        .info-value {
            color: #051920;
            word-break: break-word;
        }
        
        .message-preview {
            background-color: #f8fbff;
            border: 1px solid #d3e5f3;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .message-preview h4 {
            color: #2a83bf;
            font-size: 16px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        
        .message-preview p {
            color: #051920;
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
            font-style: italic;
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
            
            .message-info {
                padding: 20px;
            }
            
            .info-row {
                flex-direction: column;
            }
            
            .info-label {
                min-width: auto;
                margin-bottom: 5px;
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
            <h2 class="notification-header">💬 Neue Nachricht erhalten</h2>
            
            <p class="message">
                Sie haben eine neue Nachricht im Kraatz Group Dozentenportal erhalten.
            </p>
            
            <div class="message-info">
                <h3>Nachrichten-Details</h3>
                
                <div class="info-row">
                    <span class="info-label">Von:</span>
                    <span class="info-value">${data.senderName}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">E-Mail:</span>
                    <span class="info-value">${data.senderEmail}</span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">Gesendet am:</span>
                    <span class="info-value">${data.sendDate}</span>
                </div>
            </div>
            
            <div class="message-preview">
                <h4>Nachrichtenvorschau:</h4>
                <p>${data.messageContent.length > 150 ? data.messageContent.substring(0, 150) + '...' : data.messageContent}</p>
            </div>
            
            <div class="button-center">
                <a href="${data.portalUrl}/messages" class="action-button">Öffnen & antworten</a>
            </div>
            
            <p class="message">
                Loggen Sie sich in das Dozentenportal ein, um die vollständige Nachricht zu lesen 
                und darauf zu antworten.
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
                Bitte antworten Sie nicht auf diese E-Mail.
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
  console.log('🚀 send-message-notification function started');
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
    const { messageId, senderId, receiverId, content } = await req.json();
    console.log('📋 Request data:', { messageId, senderId, receiverId, contentLength: content?.length });

    // Get message details with sender and receiver information
    console.log('🔍 Fetching message data for messageId:', messageId);
    const { data: messageData, error: messageError } = await supabaseClient
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(full_name, email),
        receiver:profiles!messages_receiver_id_fkey(full_name, email)
      `)
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error('❌ Error fetching message data:', messageError);
      throw messageError;
    }
    console.log('✅ Message data fetched successfully:', {
      id: messageData.id,
      sender: messageData.sender.full_name,
      receiver: messageData.receiver.full_name,
      created_at: messageData.created_at
    });

    // Prepare email data
    console.log('📧 Preparing email data...');
    const portalUrl = Deno.env.get('SITE_URL') || 'http://portal.kraatz-group.de';
    console.log('🌐 Portal URL:', portalUrl);
    
    const emailData: MessageEmailData = {
      senderName: messageData.sender.full_name,
      senderEmail: messageData.sender.email,
      receiverName: messageData.receiver.full_name,
      receiverEmail: messageData.receiver.email,
      messageContent: content,
      sendDate: formatDate(messageData.created_at),
      portalUrl: portalUrl
    };
    console.log('📧 Email data prepared:', {
      ...emailData,
      messageContent: emailData.messageContent.substring(0, 50) + '...'
    });

    // Generate email HTML
    console.log('📧 Generating email HTML...');
    const emailHtml = getMessageEmailTemplate(emailData);
    const subject = `💬 Neue Nachricht von ${emailData.senderName} - Kraatz Group Portal`;
    console.log('📧 Email subject:', subject);
    
    try {
      // Send email using Resend API
      console.log('📤 Sending email to:', emailData.receiverEmail);
      const result = await sendEmailViaResend(emailData.receiverEmail, subject, emailHtml);
      
      console.log(`✅ Email notification sent successfully to ${emailData.receiverEmail}`, result);

      const responseData = { 
        message: 'Message notification email sent successfully',
        emailId: result.id
      };
      console.log('📤 Sending success response:', responseData);
      
      return new Response(
        JSON.stringify(responseData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError) {
      console.error(`❌ Failed to send email to ${emailData.receiverEmail}:`, emailError);
      
      // Don't fail the message sending if email fails
      const errorResponse = { 
        message: 'Message sent, email notification failed',
        emailError: emailError.message
      };
      console.log('⚠️ Sending error response (non-critical):', errorResponse);
      
      return new Response(
        JSON.stringify(errorResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Critical error in send-message-notification function:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Don't fail the message sending if email fails
    const criticalErrorResponse = { 
      message: 'Message sent, email notification failed',
      error: error.message 
    };
    console.log('⚠️ Sending critical error response (non-critical):', criticalErrorResponse);
    
    return new Response(
      JSON.stringify(criticalErrorResponse),
      { 
        status: 200, // Return 200 so message sending doesn't fail
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});