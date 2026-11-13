import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler } from './sync.mjs';
Deno.serve(createHandler({createClient,env:(name:string)=>Deno.env.get(name)}));
