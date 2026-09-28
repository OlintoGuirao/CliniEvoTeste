package com.olintoguirrao.clinievo;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "InstagramStoryPlugin")
public class InstagramStoryPlugin extends Plugin {

    @PluginMethod
    public void shareToStory(PluginCall call) {
        String filePath = call.getString("filePath");
        String fileProviderAuthority = call.getString("fileProviderAuthority");
        String attributionLinkUrl = call.getString("attributionLinkUrl");

        if (filePath == null || filePath.isEmpty()
                || fileProviderAuthority == null || fileProviderAuthority.isEmpty()) {
            call.reject("filePath e fileProviderAuthority são obrigatórios");
            return;
        }

        Bridge bridge = getBridge();
        if (bridge == null || bridge.getActivity() == null) {
            call.reject("Bridge ou Activity indisponível");
            return;
        }

        Uri inputUri;
        File file = null;
        try {
            android.util.Log.d("InstagramStoryPlugin", "shareToStory() chamado. filePath=" + filePath
                    + " provider=" + fileProviderAuthority);
            // Aceita tanto caminhos absolutos ("/data/user/0/...") quanto URIs ("file://", "content://")
            if (filePath.startsWith("file://") || filePath.startsWith("content://")) {
                inputUri = Uri.parse(filePath);
                if ("file".equals(inputUri.getScheme())) {
                    file = new File(inputUri.getPath());
                }
            } else {
                file = new File(filePath);
                inputUri = Uri.fromFile(file);
            }
        } catch (Exception e) {
            call.reject("filePath inválido: " + filePath, e);
            return;
        }

        if (file != null && !file.exists()) {
            android.util.Log.e("InstagramStoryPlugin", "Arquivo não encontrado em: " + filePath);
            call.reject("Arquivo não encontrado em: " + filePath);
            return;
        }

        PackageManager pm = getContext().getPackageManager();
        String instaPackage = "com.instagram.android";
        try {
            pm.getPackageInfo(instaPackage, 0);
        } catch (PackageManager.NameNotFoundException e) {
            // Instagram não instalado
            JSObject result = new JSObject();
            result.put("installed", false);
            result.put("opened", false);
            call.resolve(result);
            return;
        }

        // Uri segura do arquivo (imagem 1080x1920)
        Uri uri;
        if (file != null) {
            // Usa FileProvider quando temos File local
            uri = FileProvider.getUriForFile(
                    getContext(),
                    fileProviderAuthority,
                    file
            );
        } else {
            // Quando recebemos um "content://" já pronto
            uri = inputUri;
        }

        // Intent oficial para Story
        Intent intent = new Intent("com.instagram.share.ADD_TO_STORY");

        // Define a imagem como fundo do story
        intent.setDataAndType(uri, "image/*");
        intent.setType("image/*");

        // Extra recomendado pelo Instagram para background
        intent.putExtra("background_asset_uri", uri);

        // Identifica o app de origem
        String sourceApp = getContext().getPackageName();
        intent.putExtra("source_application", sourceApp);

        // Cores de fundo (algumas versões usam isso em vez de ignorar)
        intent.putExtra("top_background_color", "#000000");
        intent.putExtra("bottom_background_color", "#000000");

        // Link de atribuição opcional (ex.: URL do resumo da sessão)
        if (attributionLinkUrl != null && !attributionLinkUrl.isEmpty()) {
            intent.putExtra("content_url", attributionLinkUrl);
        }

        // Permissões obrigatórias
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        // Concede permissão de leitura para todas as activities que aceitarem o intent
        for (android.content.pm.ResolveInfo resolveInfo :
                pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)) {
            getContext().grantUriPermission(
                    resolveInfo.activityInfo.packageName,
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        }

        try {
            android.util.Log.d("InstagramStoryPlugin", "Abrindo Instagram Story com URI=" + uri.toString());
            intent.setPackage(instaPackage);
            // Força a Activity a aparecer na frente (evita ficar atrás do app)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);

            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("installed", true);
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException e) {
            String detail = e.getMessage() != null ? e.getMessage() : "Activity não encontrada";
            android.util.Log.e("InstagramStoryPlugin", "ActivityNotFoundException: " + detail, e);
            call.reject("Instagram Story: " + detail);
        } catch (Exception e) {
            String detail = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            android.util.Log.e("InstagramStoryPlugin", "Erro: " + detail, e);
            call.reject("Instagram Story erro: " + detail);
        }
    }
}

