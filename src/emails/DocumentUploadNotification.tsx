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

interface DocumentUploadNotificationProps {
  dozentName: string;
  dozentEmail: string;
  documentName: string;
  fileSize: string;
  uploadDate: string;
  documentCategory: string;
  adminPortalUrl: string;
}

export default function DocumentUploadNotification({
  dozentName,
  dozentEmail,
  documentName,
  fileSize,
  uploadDate,
  documentCategory,
  adminPortalUrl,
}: DocumentUploadNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Neues Dokument von {dozentName} hochgeladen</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={headerTitle}>Kraatz Group</Heading>
            <Text style={headerSubtitle}>Dozentenportal - Admin</Text>
          </Section>
          
          <Section style={content}>
            <Heading style={h1}>📄 Neues Dokument hochgeladen</Heading>
            
            <Text style={text}>
              Ein Dozent hat ein neues Dokument im Dozentenportal hochgeladen, 
              das möglicherweise Ihre Aufmerksamkeit erfordert.
            </Text>
            
            <Section style={infoBox}>
              <Heading style={infoTitle}>Dokument-Details</Heading>
              
              <Text style={infoRow}>
                <strong>Dozent:</strong> {dozentName}
              </Text>
              <Text style={infoRow}>
                <strong>E-Mail:</strong> {dozentEmail}
              </Text>
              <Text style={infoRow}>
                <strong>Dateiname:</strong> {documentName}
              </Text>
              <Text style={infoRow}>
                <strong>Dateigröße:</strong> {fileSize}
              </Text>
              <Text style={infoRow}>
                <strong>Hochgeladen am:</strong> {uploadDate}
              </Text>
              <Text style={infoRow}>
                <strong>Kategorie:</strong> {documentCategory}
              </Text>
            </Section>
            
            <Section style={buttonContainer}>
              <Link href={adminPortalUrl} style={button}>
                Zum Admin-Portal
              </Link>
            </Section>
            
            <Text style={text}>
              Sie können das Dokument im Admin-Bereich einsehen, herunterladen und bei Bedarf 
              den Status ändern oder Rückmeldungen an den Dozenten senden.
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