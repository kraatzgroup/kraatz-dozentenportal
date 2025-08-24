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

interface DocumentReminderNotificationProps {
  dozentName: string;
  missingDocuments: string[];
  previousMonth: string;
  previousYear: number;
  deadline: string;
  portalUrl: string;
  adminName: string;
}

export default function DocumentReminderNotification({
  dozentName,
  missingDocuments,
  previousMonth,
  previousYear,
  deadline,
  portalUrl,
  adminName,
}: DocumentReminderNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Erinnerung: Fehlende Dokumente für {previousMonth} {previousYear}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={headerTitle}>Kraatz Group</Heading>
            <Text style={headerSubtitle}>Dozentenportal</Text>
          </Section>
          
          <Section style={content}>
            <Heading style={h1}>📋 Erinnerung: Fehlende Dokumente</Heading>
            
            <Text style={text}>Liebe/r {dozentName},</Text>
            
            <Text style={text}>
              wir hoffen, Sie sind wohlauf. Bei der Überprüfung unserer Unterlagen ist uns aufgefallen, 
              dass für den Monat <strong>{previousMonth} {previousYear}</strong> noch wichtige Dokumente von Ihnen fehlen.
            </Text>
            
            <Section style={warningBox}>
              <Heading style={warningTitle}>⚠️ Benötigte Unterlagen</Heading>
              <Text style={warningText}>
                Um die ordnungsgemäße Abrechnung und Dokumentation sicherzustellen, benötigen wir 
                folgende Dokumente vollständig und fristgerecht.
              </Text>
            </Section>
            
            <Section style={documentList}>
              <Heading style={listTitle}>Noch ausstehende Dokumente:</Heading>
              {missingDocuments.map((doc, index) => (
                <Text key={index} style={listItem}>
                  📄 <strong>{doc}</strong>
                </Text>
              ))}
            </Section>
            
            <Section style={deadlineBox}>
              <Heading style={deadlineTitle}>🕒 Wichtiger Hinweis zur Frist</Heading>
              <Text style={deadlineText}>
                Bitte laden Sie alle fehlenden Dokumente bis <strong>{deadline}</strong> 
                in das System hoch. Eine spätere Einreichung kann zu Verzögerungen bei der 
                Bearbeitung und Auszahlung führen.
              </Text>
            </Section>
            
            <Text style={text}>
              Wir verstehen, dass es manchmal zu Verzögerungen kommen kann, und schätzen Ihre 
              kontinuierliche Zusammenarbeit sehr. Die rechtzeitige Einreichung aller Unterlagen 
              hilft uns dabei, Ihre Abrechnungen schnell und korrekt zu bearbeiten.
            </Text>
            
            <Section style={buttonContainer}>
              <Link href={`${portalUrl}/dashboard`} style={button}>
                Dokumente jetzt hochladen
              </Link>
            </Section>
            
            <Text style={text}>
              Falls Sie Fragen haben oder Unterstützung beim Upload benötigen, zögern Sie nicht, 
              sich an uns zu wenden. Wir stehen Ihnen gerne zur Verfügung.
            </Text>
            
            <Text style={text}>
              Vielen Dank für Ihr Verständnis und Ihre prompte Bearbeitung.
            </Text>
            
            <Text style={text}>
              Mit freundlichen Grüßen<br />
              <strong>{adminName}</strong><br />
              Akademie Kraatz GmbH
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
              Bitte antworten Sie nicht direkt auf diese Nachricht.
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

const warningBox = {
  backgroundColor: '#fff3cd',
  borderLeft: '4px solid #ffc107',
  padding: '25px',
  margin: '30px 0',
  borderRadius: '0 8px 8px 0',
};

const warningTitle = {
  color: '#856404',
  fontSize: '18px',
  marginBottom: '15px',
  fontWeight: '600',
};

const warningText = {
  color: '#856404',
  fontSize: '14px',
  margin: '0',
};

const documentList = {
  backgroundColor: '#f8fbff',
  border: '1px solid #d3e5f3',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 0',
};

const listTitle = {
  color: '#2a83bf',
  fontSize: '16px',
  marginBottom: '15px',
  fontWeight: '600',
};

const listItem = {
  color: '#051920',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '8px 0',
};

const deadlineBox = {
  backgroundColor: '#f8d7da',
  borderLeft: '4px solid #dc3545',
  padding: '20px',
  margin: '25px 0',
  borderRadius: '0 8px 8px 0',
};

const deadlineTitle = {
  color: '#721c24',
  fontSize: '16px',
  marginBottom: '10px',
  fontWeight: '600',
};

const deadlineText = {
  color: '#721c24',
  fontSize: '14px',
  margin: '0',
  fontWeight: '500',
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