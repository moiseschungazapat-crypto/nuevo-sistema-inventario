import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

const nullable = (type: Record<string, unknown>) => ({ anyOf: [type, { type: "null" }] });
const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    provider: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: nullable({ type: "string" }),
        ruc: nullable({ type: "string" }),
      },
      required: ["name", "ruc"],
    },
    document: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: nullable({ type: "string" }),
        series: nullable({ type: "string" }),
        number: nullable({ type: "string" }),
        issue_date: nullable({ type: "string" }),
        currency: nullable({ type: "string" }),
        guide_number: nullable({ type: "string" }),
        purchase_order: nullable({ type: "string" }),
      },
      required: ["type", "series", "number", "issue_date", "currency", "guide_number", "purchase_order"],
    },
    payment: {
      type: "object",
      additionalProperties: false,
      properties: {
        method: nullable({ type: "string" }),
        condition: nullable({ type: "string" }),
        due_date: nullable({ type: "string" }),
        status: nullable({ type: "string" }),
      },
      required: ["method", "condition", "due_date", "status"],
    },
    totals: {
      type: "object",
      additionalProperties: false,
      properties: {
        subtotal: nullable({ type: "number" }),
        discount: nullable({ type: "number" }),
        tax: nullable({ type: "number" }),
        total: nullable({ type: "number" }),
        withholding_percent: nullable({ type: "number" }),
        withholding_amount: nullable({ type: "number" }),
      },
      required: ["subtotal", "discount", "tax", "total", "withholding_percent", "withholding_amount"],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: nullable({ type: "string" }),
          name: nullable({ type: "string" }),
          description: nullable({ type: "string" }),
          quantity_invoiced: nullable({ type: "number" }),
          unit: nullable({ type: "string" }),
          unit_price: nullable({ type: "number" }),
          lot_code: nullable({ type: "string" }),
          expiration_date: nullable({ type: "string" }),
        },
        required: ["code", "name", "description", "quantity_invoiced", "unit", "unit_price", "lot_code", "expiration_date"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["provider", "document", "payment", "totals", "items", "warnings"],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function keyFromJson(name: string) {
  try {
    const value = JSON.parse(Deno.env.get(name) || "{}");
    return value.default || Object.values(value)[0] || "";
  } catch {
    return "";
  }
}

function publishableKey() {
  return Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || keyFromJson("SUPABASE_PUBLISHABLE_KEYS");
}

function secretKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SECRET_KEY")
    || keyFromJson("SUPABASE_SECRET_KEYS");
}

function validStorageUrl(value: string) {
  try {
    const url = new URL(value);
    const base = new URL(projectUrl);
    return url.origin === base.origin
      && url.pathname.startsWith("/storage/v1/object/sign/documentos-recepcion/");
  } catch {
    return false;
  }
}

function fileType(file: { mime_type?: string; name?: string }) {
  const mime = String(file.mime_type || "").toLowerCase();
  if (mime === "application/pdf" || /\.pdf$/i.test(file.name || "")) return "application/pdf";
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) return mime;
  return "";
}

async function cleanPending(paths: string[]) {
  const key = secretKey();
  if (!projectUrl || !key || !paths.length) return;
  const admin = createClient(projectUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
  await admin.storage.from("documentos-recepcion").remove(
    paths.filter(path => path.startsWith("ocr-pending/")),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  if (!projectUrl) return json({ error: "La función no tiene configurado SUPABASE_URL." }, 500);
  if (!openAiKey) return json({ error: "Falta configurar OPENAI_API_KEY en los secretos de la Edge Function." }, 503);

  const authorization = request.headers.get("Authorization") || "";
  const userKey = publishableKey();
  if (!authorization.startsWith("Bearer ") || !userKey) {
    return json({ error: "Sesión no autorizada." }, 401);
  }

  const userClient = createClient(projectUrl, userKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sesión no autorizada." }, 401);

  let body: { files?: Array<{ url?: string; path?: string; name?: string; mime_type?: string }> };
  try {
    body = await request.json();
  } catch {
    return json({ error: "La solicitud no contiene JSON válido." }, 400);
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > 6) return json({ error: "Adjunta entre 1 y 6 imágenes o archivos PDF." }, 400);
  const accepted = files.map(file => ({
    url: String(file.url || ""),
    path: String(file.path || ""),
    name: String(file.name || "factura"),
    mime_type: fileType(file),
  }));
  if (accepted.some(file => !file.mime_type || !validStorageUrl(file.url))) {
    return json({ error: "Solo se aceptan imágenes o PDF privados cargados en documentos-recepcion." }, 400);
  }

  const content = [
    {
      type: "input_text",
      text: [
        "Analiza la factura o comprobante peruano adjunto y extrae únicamente datos visibles.",
        "Devuelve null cuando un dato no aparezca o no pueda leerse. No inventes RUC, fechas, códigos, cantidades ni precios.",
        "Usa fechas en formato AAAA-MM-DD y números sin símbolos de moneda.",
        "Los items representan cantidades facturadas, no cantidades recibidas físicamente.",
        "Si hay varias páginas o imágenes, combina la información sin duplicar líneas.",
        "El campo warnings debe mencionar datos borrosos, ausentes o que requieran confirmación humana.",
      ].join(" "),
    },
    ...accepted.map(file => file.mime_type === "application/pdf"
      ? { type: "input_file", file_url: file.url, filename: file.name }
      : { type: "input_image", image_url: file.url, detail: "high" }),
  ];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + openAiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "factura_inventario",
            strict: true,
            schema: extractionSchema,
          },
        },
      }),
    });
  } finally {
    try {
      await cleanPending(accepted.map(file => file.path));
    } catch (cleanupError) {
      console.warn("No se pudo limpiar el archivo temporal de OCR", cleanupError);
    }
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI invoice analysis failed", response.status, detail.slice(0, 500));
    return json({ error: "No se pudo analizar la factura. Revisa la configuración de inteligencia y vuelve a intentarlo." }, 502);
  }

  const result = await response.json();
  const outputText = Array.isArray(result.output)
    ? result.output.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text || "")
      .join("")
    : "";
  if (!outputText) return json({ error: "La inteligencia no devolvió datos legibles." }, 502);

  try {
    return json({ extraction: JSON.parse(outputText), model });
  } catch {
    console.error("OpenAI returned non-JSON invoice extraction", outputText.slice(0, 500));
    return json({ error: "La respuesta de análisis no tiene un formato válido." }, 502);
  }
});
