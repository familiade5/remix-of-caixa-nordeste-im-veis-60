import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, stagingId, propertyId, updates } = await req.json();

    switch (action) {
      case 'import': {
        // Buscar imóvel no staging
        const { data: staging, error: stagingError } = await supabase
          .from('staging_properties')
          .select('*')
          .eq('id', stagingId)
          .single();

        if (stagingError || !staging) {
          return new Response(
            JSON.stringify({ success: false, error: 'Imóvel não encontrado no staging' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Inserir na tabela de properties
        const { data: newProperty, error: insertError } = await supabase
          .from('properties')
          .insert({
            external_id: staging.external_id,
            title: staging.title,
            type: staging.type,
            status: 'available',
            price: staging.price,
            original_price: staging.original_price,
            discount: staging.discount,
            address_neighborhood: staging.address_neighborhood,
            address_city: staging.address_city,
            address_state: staging.address_state,
            bedrooms: staging.bedrooms,
            bathrooms: staging.bathrooms,
            area: staging.area,
            parking_spaces: staging.parking_spaces,
            images: staging.images,
            description: staging.description,
            accepts_fgts: staging.accepts_fgts,
            accepts_financing: staging.accepts_financing,
            auction_date: staging.auction_date,
            modality: staging.modality,
            caixa_link: staging.caixa_link,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao importar imóvel' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Atualizar status no staging
        await supabase
          .from('staging_properties')
          .update({ status: 'imported', reviewed_at: new Date().toISOString() })
          .eq('id', stagingId);

        return new Response(
          JSON.stringify({ success: true, property: newProperty }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'ignore': {
        const { error: updateError } = await supabase
          .from('staging_properties')
          .update({ status: 'ignored', reviewed_at: new Date().toISOString() })
          .eq('id', stagingId);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao ignorar imóvel' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-staging': {
        const { error: deleteError } = await supabase
          .from('staging_properties')
          .delete()
          .eq('id', stagingId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao deletar imóvel do staging' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete-property': {
        const { error: deleteError } = await supabase
          .from('properties')
          .delete()
          .eq('id', propertyId);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao deletar imóvel' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'bulk-delete-staging': {
        const { stagingIds } = updates;
        let deleted = 0;

        for (const id of stagingIds) {
          const { error } = await supabase
            .from('staging_properties')
            .delete()
            .eq('id', id);

          if (!error) {
            deleted++;
          }
        }

        return new Response(
          JSON.stringify({ success: true, deleted }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clear-all-staging': {
        const { count } = await supabase
          .from('staging_properties')
          .select('*', { count: 'exact', head: true });

        const { error: deleteError } = await supabase
          .from('staging_properties')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao limpar staging' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, deleted: count || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'clear-all-properties': {
        const { count } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        const { error: deleteError } = await supabase
          .from('properties')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao limpar imóveis' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, deleted: count || 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-property-status': {
        const { error: updateError } = await supabase
          .from('properties')
          .update({ 
            status: updates.status,
            sold_at: updates.status === 'sold' ? new Date().toISOString() : null,
          })
          .eq('id', propertyId);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao atualizar status' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'bulk-import': {
        const { stagingIds } = updates;
        let imported = 0;
        let errors = 0;

        for (const id of stagingIds) {
          const { data: staging } = await supabase
            .from('staging_properties')
            .select('*')
            .eq('id', id)
            .single();

          if (staging) {
            const { error } = await supabase
              .from('properties')
              .insert({
                external_id: staging.external_id,
                title: staging.title,
                type: staging.type,
                status: 'available',
                price: staging.price,
                original_price: staging.original_price,
                discount: staging.discount,
                address_neighborhood: staging.address_neighborhood,
                address_city: staging.address_city,
                address_state: staging.address_state,
                bedrooms: staging.bedrooms,
                bathrooms: staging.bathrooms,
                area: staging.area,
                parking_spaces: staging.parking_spaces,
                images: staging.images,
                description: staging.description,
                accepts_fgts: staging.accepts_fgts,
                accepts_financing: staging.accepts_financing,
                auction_date: staging.auction_date,
                modality: staging.modality,
                caixa_link: staging.caixa_link,
              });

            if (!error) {
              await supabase
                .from('staging_properties')
                .update({ status: 'imported', reviewed_at: new Date().toISOString() })
                .eq('id', id);
              imported++;
            } else {
              errors++;
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, imported, errors }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
