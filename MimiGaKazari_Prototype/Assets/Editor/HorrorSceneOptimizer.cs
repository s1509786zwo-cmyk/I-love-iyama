using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace MimiHorror.EditorTools
{
    /// <summary>
    /// シーン軽量化の定型作業をワンクリック化するメニュー集。
    /// Tools > Mimi Horror 配下。
    /// </summary>
    public static class HorrorSceneOptimizer
    {
        // ------------------------------------------------------------------
        // 1. Static フラグ一括付与（ライトベイク＋オクルージョン＋バッチングの前提）
        // ------------------------------------------------------------------
        [MenuItem("Tools/Mimi Horror/1. Apply Static Flags to Selection Hierarchy")]
        private static void ApplyStaticFlags()
        {
            int count = 0;

            foreach (GameObject root in Selection.gameObjects)
            {
                Transform[] all = root.GetComponentsInChildren<Transform>(true);
                foreach (Transform t in all)
                {
                    GameObject go = t.gameObject;
                    if (go.GetComponent<MeshRenderer>() == null)
                    {
                        continue;
                    }

                    Undo.RecordObject(go, "Apply Static Flags");
                    GameObjectUtility.SetStaticEditorFlags(
                        go,
                        StaticEditorFlags.BatchingStatic
                        | StaticEditorFlags.OccluderStatic
                        | StaticEditorFlags.OccludeeStatic
                        | StaticEditorFlags.ContributeGI
                        | StaticEditorFlags.ReflectionProbeStatic);
                    count++;
                }
            }

            MarkDirty();
            Debug.Log($"[Mimi Horror] Static フラグを {count} 個の MeshRenderer に適用しました。" +
                      "動くドア・人形などは Inspector 右上の Static チェックを外してください。");
        }

        [MenuItem("Tools/Mimi Horror/1. Apply Static Flags to Selection Hierarchy", true)]
        private static bool ValidateApplyStaticFlags()
        {
            return Selection.gameObjects.Length > 0;
        }

        // ------------------------------------------------------------------
        // 2. 暗闇フォグ＋カメラ描画距離の初期設定
        // ------------------------------------------------------------------
        [MenuItem("Tools/Mimi Horror/2. Setup Horror Darkness (Fog + Far Plane)")]
        private static void SetupHorrorDarkness()
        {
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.005f, 0.005f, 0.008f, 1f);
            RenderSettings.fogStartDistance = 2f;
            RenderSettings.fogEndDistance = 16f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.04f, 0.04f, 0.05f, 1f);

            Camera camera = Camera.main;
            if (camera != null)
            {
                Undo.RecordObject(camera, "Setup Horror Darkness");
                camera.farClipPlane = 25f;
                camera.nearClipPlane = 0.05f;
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = RenderSettings.fogColor;
                camera.useOcclusionCulling = true;
            }

            MarkDirty();
            Debug.Log("[Mimi Horror] 暗闇設定を適用しました：" +
                      "Fog=Linear 2〜16m / Camera Far=25m / 背景色＝Fog色 / Occlusion Culling ON。" +
                      "数値は Window > Rendering > Lighting > Environment と Camera の Inspector で微調整してください。");
        }

        // ------------------------------------------------------------------
        // 3. リアルタイムライト監査（ベイク漏れ検出）
        // ------------------------------------------------------------------
        [MenuItem("Tools/Mimi Horror/3. Report Realtime Lights")]
        private static void ReportRealtimeLights()
        {
#if UNITY_2023_1_OR_NEWER
            Light[] lights = Object.FindObjectsByType<Light>(FindObjectsInactive.Include, FindObjectsSortMode.None);
#else
            Light[] lights = Object.FindObjectsOfType<Light>(true);
#endif
            int realtimeCount = 0;
            int shadowCount = 0;

            foreach (Light light in lights)
            {
                if (light.lightmapBakeType == LightmapBakeType.Baked)
                {
                    continue;
                }

                realtimeCount++;
                bool castsShadow = light.shadows != LightShadows.None;
                if (castsShadow) shadowCount++;

                Debug.Log(
                    $"[Mimi Horror] リアルタイムライト: {GetHierarchyPath(light.gameObject)} " +
                    $"type={light.type}, bake={light.lightmapBakeType}, shadow={(castsShadow ? "ON" : "OFF")}",
                    light.gameObject);
            }

            if (realtimeCount == 0)
            {
                Debug.Log("[Mimi Horror] リアルタイムライトはありません（全ベイク状態です）。懐中電灯 1 灯だけ Realtime にしてください。");
            }
            else
            {
                Debug.Log($"[Mimi Horror] 監査完了：リアルタイムライト {realtimeCount} 灯（うちシャドウON {shadowCount} 灯）。" +
                          "目標は「懐中電灯 1 灯のみ Realtime＋シャドウON」、残りはすべて Baked です。");
            }
        }

        private static string GetHierarchyPath(GameObject go)
        {
            string path = go.name;
            Transform parent = go.transform.parent;
            while (parent != null)
            {
                path = parent.name + "/" + path;
                parent = parent.parent;
            }
            return path;
        }

        private static void MarkDirty()
        {
            Scene scene = SceneManager.GetActiveScene();
            if (scene.IsValid())
            {
                EditorSceneManager.MarkSceneDirty(scene);
            }
        }
    }
}
