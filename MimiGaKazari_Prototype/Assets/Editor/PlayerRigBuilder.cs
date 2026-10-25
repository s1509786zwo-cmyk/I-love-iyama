using MimiHorror.Interaction;
using MimiHorror.Player;
using UnityEditor;
using UnityEngine;

namespace MimiHorror.EditorTools
{
    /// <summary>
    /// ワンクリックで一人称プレイヤーの階層を作る。
    /// メニュー：Tools > Mimi Horror > Create Player Rig (FPS)
    ///
    /// 生成される階層:
    /// Player               … CharacterController / LightFPSController / PlayerInteractor
    /// ├─ CameraHolder      … 上下回転担当（目の高さ 1.6m）
    /// │   └─ Main Camera   … ヘッドボブで微振動する側
    /// └─ Flashlight        … Spot Light + FlashlightController（LateUpdate で追従）
    /// </summary>
    public static class PlayerRigBuilder
    {
        [MenuItem("Tools/Mimi Horror/Create Player Rig (FPS)")]
        private static void CreatePlayerRig()
        {
            // --- Player 本体 ---
            GameObject player = new GameObject("Player");
            Undo.RegisterCreatedObjectUndo(player, "Create Player Rig");

            CharacterController controller = player.AddComponent<CharacterController>();
            controller.height = 1.7f;
            controller.radius = 0.32f;
            controller.center = new Vector3(0f, 0.85f, 0f);
            controller.stepOffset = 0.3f;
            controller.slopeLimit = 45f;
            controller.skinWidth = 0.08f;

            LightFPSController fps = player.AddComponent<LightFPSController>();
            PlayerInteractor interactor = player.AddComponent<PlayerInteractor>();

            // --- CameraHolder / Main Camera ---
            GameObject holder = new GameObject("CameraHolder");
            holder.transform.SetParent(player.transform, false);
            holder.transform.localPosition = new Vector3(0f, 1.6f, 0f);

            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(holder.transform, false);
            cameraObject.transform.localPosition = Vector3.zero;

            Camera camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 75f;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 25f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.005f, 0.005f, 0.008f, 1f);
            camera.useOcclusionCulling = true;
            cameraObject.AddComponent<AudioListener>();

            // --- Flashlight ---
            GameObject flashlightObject = new GameObject("Flashlight");
            flashlightObject.transform.SetParent(player.transform, false);
            flashlightObject.transform.localPosition = new Vector3(0.18f, 1.45f, 0.05f);

            Light spot = flashlightObject.AddComponent<Light>();
            spot.type = LightType.Spot;
            spot.spotAngle = 55f;
            spot.innerSpotAngle = 35f;
            spot.range = 14f;
            spot.intensity = 3f;
            spot.color = new Color(1f, 0.96f, 0.88f, 1f);
            spot.shadows = LightShadows.Soft;
            spot.shadowStrength = 1f;
            spot.lightmapBakeType = LightmapBakeType.Realtime;

            FlashlightController flashlight = flashlightObject.AddComponent<FlashlightController>();

            // --- SerializeField への割り当て ---
            Assign(fps, "cameraHolder", holder.transform);
            Assign(fps, "bobTarget", cameraObject.transform);
            Assign(interactor, "cameraTransform", cameraObject.transform);
            Assign(flashlight, "spotLight", spot);
            Assign(flashlight, "aimSource", cameraObject.transform);

            // --- 既存の初期カメラが残っていた場合の注意 ---
            Selection.activeGameObject = player;
            EditorGUIUtility.PingObject(player);

            Debug.Log(
                "[Mimi Horror] Player Rig を作成しました。\n" +
                "1) シーンに元からある Main Camera が別に残っていたら削除してください（カメラは1台だけ）。\n" +
                "2) Player を家の床の上に移動させてください（原点＝足元です）。\n" +
                "3) Edit > Project Settings > Player > Active Input Handling が Old または Both か確認してください。\n" +
                "4) 再生ボタンで WASD / マウス / F（ライト）/ E（調べる）をテストしてください。");
        }

        private static void Assign(Object target, string propertyName, Object value)
        {
            SerializedObject serialized = new SerializedObject(target);
            SerializedProperty property = serialized.FindProperty(propertyName);
            if (property != null)
            {
                property.objectReferenceValue = value;
                serialized.ApplyModifiedPropertiesWithoutUndo();
            }
            else
            {
                Debug.LogWarning($"[PlayerRigBuilder] フィールド '{propertyName}' が見つかりません：{target.GetType().Name}");
            }
        }
    }
}
