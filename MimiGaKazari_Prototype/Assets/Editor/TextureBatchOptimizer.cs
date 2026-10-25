using UnityEditor;
using UnityEngine;

namespace MimiHorror.EditorTools
{
    /// <summary>
    /// フォルダ内の全テクスチャの Max Size / 圧縮を一括設定するウィンドウ。
    /// メニュー：Tools > Mimi Horror > Texture Batch Optimizer
    /// 4K テクスチャを 1024 / 2048 に落とすのが低スペック対策の第一歩。
    /// </summary>
    public class TextureBatchOptimizer : EditorWindow
    {
        private Object _folder;
        private int _maxSizeIndex = 1;        // 1024
        private int _normalMaxSizeIndex = 1;  // 1024
        private bool _enableMipMaps = true;
        private bool _useCompression = true;

        private static readonly string[] SizeLabels = { "512", "1024", "2048", "4096" };
        private static readonly int[] SizeValues = { 512, 1024, 2048, 4096 };

        [MenuItem("Tools/Mimi Horror/Texture Batch Optimizer")]
        private static void Open()
        {
            GetWindow<TextureBatchOptimizer>("Texture Optimizer");
        }

        private void OnGUI()
        {
            EditorGUILayout.LabelField("テクスチャ一括軽量化", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "外部アセットを入れたフォルダを指定して実行してください。\n" +
                "元の画像ファイル自体は変わらず、Unity 内の取り込み上限だけが変わります（いつでも戻せます）。",
                MessageType.Info);

            _folder = EditorGUILayout.ObjectField("対象フォルダ（空＝Assets 全体）", _folder, typeof(DefaultAsset), false);
            _maxSizeIndex = EditorGUILayout.Popup("通常テクスチャ Max Size", _maxSizeIndex, SizeLabels);
            _normalMaxSizeIndex = EditorGUILayout.Popup("法線マップ Max Size", _normalMaxSizeIndex, SizeLabels);
            _enableMipMaps = EditorGUILayout.Toggle("Generate Mip Maps を ON", _enableMipMaps);
            _useCompression = EditorGUILayout.Toggle("圧縮（Compressed）を適用", _useCompression);

            EditorGUILayout.Space();

            if (GUILayout.Button("一括適用する", GUILayout.Height(32f)))
            {
                Apply();
            }

            EditorGUILayout.HelpBox(
                "目安：壁・床・畳＝1024、主人公が近づく人形の顔など主役級だけ 2048、法線＝1024。\n" +
                "Mip Map は 3D 用テクスチャでは必ず ON（遠景のチラつき防止＋描画軽量化）。",
                MessageType.None);
        }

        private void Apply()
        {
            string folderPath = _folder != null ? AssetDatabase.GetAssetPath(_folder) : "Assets";
            if (string.IsNullOrEmpty(folderPath))
            {
                folderPath = "Assets";
            }

            string[] guids = AssetDatabase.FindAssets("t:Texture2D", new[] { folderPath });
            int changed = 0;

            try
            {
                for (int i = 0; i < guids.Length; i++)
                {
                    string path = AssetDatabase.GUIDToAssetPath(guids[i]);

                    if (EditorUtility.DisplayCancelableProgressBar(
                            "Texture Optimizer",
                            $"{i + 1}/{guids.Length}  {path}",
                            guids.Length > 0 ? (float)i / guids.Length : 1f))
                    {
                        break;
                    }

                    if (!(AssetImporter.GetAtPath(path) is TextureImporter importer))
                    {
                        continue;
                    }

                    bool dirty = false;
                    bool isNormal = importer.textureType == TextureImporterType.NormalMap
                                    || IsNormalByName(path);

                    int target = isNormal ? SizeValues[_normalMaxSizeIndex] : SizeValues[_maxSizeIndex];

                    // 小さいテクスチャを無理に大きくすることはしない
                    if (importer.maxTextureSize > target)
                    {
                        importer.maxTextureSize = target;
                        dirty = true;
                    }

                    if (_enableMipMaps && !importer.mipmapEnabled)
                    {
                        importer.mipmapEnabled = true;
                        dirty = true;
                    }

                    if (_useCompression && importer.textureCompression != TextureImporterCompression.Compressed)
                    {
                        importer.textureCompression = TextureImporterCompression.Compressed;
                        importer.compressionQuality = 50;
                        dirty = true;
                    }

                    if (dirty)
                    {
                        importer.SaveAndReimport();
                        changed++;
                    }
                }
            }
            finally
            {
                EditorUtility.ClearProgressBar();
                AssetDatabase.Refresh();
            }

            EditorUtility.DisplayDialog(
                "Texture Optimizer",
                $"完了しました。\n対象テクスチャ：{guids.Length} 件\n設定を変更した件数：{changed} 件\n\n" +
                "次に Game ビューの Stats で VRAM 使用量を確認してください。",
                "OK");
        }

        private static bool IsNormalByName(string path)
        {
            string lower = System.IO.Path.GetFileNameWithoutExtension(path).ToLowerInvariant();
            return lower.Contains("normal")
                   || lower.EndsWith("_n")
                   || lower.EndsWith("_nor")
                   || lower.Contains("_nrm");
        }
    }
}
