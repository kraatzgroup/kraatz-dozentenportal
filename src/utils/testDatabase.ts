import { supabase } from '../lib/supabase';

export const testDatabaseConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection (without requiring authentication)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError && authError.message !== 'Auth session missing!') {
      console.error('❌ Auth error:', authError);
      return false;
    }
    
    if (user) {
      console.log('✅ Auth connection successful, user:', user?.email);
    } else {
      console.log('ℹ️ No authenticated user (this is normal for initial setup)');
    }
    
    // Check if participant_hours table exists
    console.log('🔍 Checking if participant_hours table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('participant_hours')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.error('❌ participant_hours table error:', tableError);
      console.log('📝 Table might not exist. Error details:', tableError.message);
      return false;
    }
    
    console.log('✅ participant_hours table exists with', tableCheck, 'rows');
    
    // Check if teilnehmer table exists and has data
    console.log('🔍 Checking teilnehmer table...');
    const { data: teilnehmerData, error: teilnehmerError } = await supabase
      .from('teilnehmer')
      .select('id, name')
      .limit(5);
    
    if (teilnehmerError) {
      console.error('❌ teilnehmer table error:', teilnehmerError);
      return false;
    }
    
    console.log('✅ teilnehmer table data:', teilnehmerData);
    
    // Test creating a sample hour entry
    if (user && teilnehmerData && teilnehmerData.length > 0) {
      console.log('🧪 Testing hours creation...');
      const testHours = {
        teilnehmer_id: teilnehmerData[0].id,
        dozent_id: user.id,
        hours: 1.5,
        date: new Date().toISOString().split('T')[0],
        description: 'Test entry'
      };
      
      const { data: createdHours, error: createError } = await supabase
        .from('participant_hours')
        .upsert(testHours, { 
          onConflict: 'teilnehmer_id,date',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating test hours:', createError);
        return false;
      }
      
      console.log('✅ Test hours created successfully:', createdHours);
      
      // Clean up test entry
      await supabase
        .from('participant_hours')
        .delete()
        .eq('id', createdHours.id);
      
      console.log('🧹 Test entry cleaned up');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
};

// Auto-run test when imported
testDatabaseConnection().then(success => {
  if (success) {
    console.log('🎉 Database is ready for hours tracking!');
  } else {
    console.log('⚠️ Database setup needs attention');
  }
});