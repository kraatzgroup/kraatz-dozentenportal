import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Heading,
  Hr,
  Preview,
} from '@react-email/components';

interface MessageNotificationProps {
  senderName: string;
  senderEmail: string;
  receiverName: string;
  messageContent: string;
  sendDate: string;
  portalUrl: string;
}

export default function MessageNotification({
  senderName,
  senderEmail,
  receiverName,
  messageContent,
  sendDate,
  portalUrl,
}: MessageNotificationProps) {
  const preview = messageContent.length > 50 
    ? messageContent.substring(0, 50) + '...' 
    : messageContent;

  return (
    <Html>
      <Head />
      <Preview>Neue Nachricht von {senderName}: {preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={headerTitle}>Kraatz Group</Heading>
            <Text style={headerSubtitle}>Dozentenportal</Text>
          </Section>
          
          <Section style={content}>
            <Heading style={h1}>💬 Neue Nachricht erhalten</Heading>
            
            <Text style={text}>
              Hallo {receiverName},<br />
              Sie haben eine neue Nachricht im Kraatz Group Dozentenportal erhalten.
            </Text>
            
            <Section style={infoBox}>
              <Heading style={infoTitle}>Nachrichten-Details</Heading>
              
              <Text style={infoRow}>
                <strong>Von:</strong> {senderName}
              </Text>
              <Text style={infoRow}>
                <strong>E-Mail:</strong> {senderEmail}
              </Text>
              <Text style={infoRow}>
                <strong>Gesendet am:</strong> {sendDate}
              </Text>
            </Section>
            
            <Section style={messagePreview}>
              <Heading style={previewTitle}>Nachrichtenvorschau:</Heading>
              <Text style={previewText}>
                {messageContent.length > 150 
                  ? messageContent.substring(0, 150) + '...' 
                  : messageContent}
              </Text>
            </Section>
            
            <Section style={buttonContainer}>
              <Link href={`${portalUrl}/messages`} style={button}>
                Öffnen & antworten
              </Link>
            </Section>
            
            <Text style={text}>
              Loggen Sie sich in das Dozentenportal ein, um die vollständige Nachricht zu lesen 
              und darauf zu antworten.
            </Text>
          </Section>
          
          <Hr style={hr} />
          
          <Section style={footer}>
            <Text style={footerText}>
              <strong>Akademie Kraatz GmbH</strong><br />
              Wilmersdorfer Str. 145/146 – 10585 Berlin<br />
              📞 030 756 573 97 | 📧 info@kraatz-group.de<br />
              🌐 www.kraatz-group.de
            </Text>
            <Text style={footerNote}>
              Diese E-Mail wurde automatisch generiert. 
              Bitte antworten Sie nicht auf diese E-Mail.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f2f5fa',
  fontFamily: 'Arial, sans-serif',
  padding: '20px',
};

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(5, 25, 32, 0.1)',
  maxWidth: '600px',
  margin: '0 auto',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#2a83bf',
  padding: '40px 30px',
  textAlign: 'center' as const,
};

const headerTitle = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 8px 0',
  letterSpacing: '-0.5px',
};

const headerSubtitle = {
  color: '#d3e5f3',
  fontSize: '16px',
  fontWeight: '400',
  margin: '0',
};

const content = {
  padding: '50px 40px',
};

const h1 = {
  fontSize: '24px',
  color: '#051920',
  marginBottom: '20px',
  fontWeight: '600',
  textAlign: 'center' as const,
};

const text = {
  fontSize: '16px',
  color: '#051920',
  marginBottom: '25px',
  lineHeight: '1.7',
};

const infoBox = {
  backgroundColor: '#d3e5f3',
  borderLeft: '4px solid #2a83bf',
  padding: '25px',
  margin: '30px 0',
  borderRadius: '0 8px 8px 0',
};

const infoTitle = {
  color: '#2a83bf',
  fontSize: '18px',
  marginBottom: '15px',
  fontWeight: '600',
};

const infoRow = {
  fontSize: '14px',
  color: '#051920',
  margin: '10px 0',
};

const messagePreview = {
  backgroundColor: '#f8fbff',
  border: '1px solid #d3e5f3',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
};

const previewTitle = {
  color: '#2a83bf',
  fontSize: '16px',
  marginBottom: '10px',
  fontWeight: '600',
};

const previewText = {
  color: '#051920',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
  fontStyle: 'italic',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#2a83bf',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '16px 32px',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600',
  display: 'inline-block',
};

const hr = {
  borderColor: '#d3e5f3',
  margin: '20px 0',
};

const footer = {
  backgroundColor: '#f2f5fa',
  padding: '30px 40px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#666',
  fontSize: '14px',
  marginBottom: '10px',
};

const footerNote = {
  fontSize: '12px',
  color: '#666',
  marginTop: '20px',
  fontStyle: 'italic',
};