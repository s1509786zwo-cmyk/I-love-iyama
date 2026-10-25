using UnityEngine;

namespace MimiHorror.Player
{
    /// <summary>
    /// 懐中電灯（Spotlight）コントローラー
    /// - カメラの子にせず、LateUpdate で追従させることで「僅かな遅れ」を作れる
    /// - このシーンで唯一のリアルタイム＋シャドウありライトとして使う想定
    /// </summary>
    public class FlashlightController : MonoBehaviour
    {
        [Header("参照")]
        [SerializeField] private Light spotLight;
        [Tooltip("照準の基準。通常は Main Camera")]
        [SerializeField] private Transform aimSource;

        [Header("基本")]
        [SerializeField] private KeyCode toggleKey = KeyCode.F;
        [SerializeField] private bool startOn = true;
        [Tooltip("カメラから見た手元のオフセット（右手で持っている感）")]
        [SerializeField] private Vector3 handOffset = new Vector3(0.18f, -0.15f, 0.05f);

        [Header("追従の遅れ（ホラー演出）")]
        [SerializeField] private bool enableLag = true;
        [Tooltip("小さいほど遅れてついてくる。12〜20 が目安")]
        [SerializeField] private float lagSpeed = 16f;

        [Header("チラつき（任意）")]
        [SerializeField] private bool enableFlicker = false;
        [Range(0f, 0.9f)]
        [SerializeField] private float flickerAmount = 0.18f;
        [SerializeField] private float flickerSpeed = 9f;

        [Header("音（任意）")]
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private AudioClip clickClip;

        private Transform _transform;
        private float _baseIntensity;
        private bool _isOn;

        public bool IsOn => _isOn;

        private void Awake()
        {
            _transform = transform;

            if (spotLight == null)
            {
                spotLight = GetComponent<Light>();
            }

            if (spotLight == null)
            {
                Debug.LogError("[FlashlightController] Spot Light が見つかりません。", this);
                enabled = false;
                return;
            }

            _baseIntensity = spotLight.intensity;
            SetOn(startOn, playSound: false);
        }

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                Toggle();
            }

            if (_isOn && enableFlicker)
            {
                // Random ではなく PerlinNoise なので「電池切れかけ」の自然な明滅になる
                float noise = Mathf.PerlinNoise(Time.time * flickerSpeed, 0.37f);
                spotLight.intensity = _baseIntensity * (1f - flickerAmount * (1f - noise));
            }
        }

        private void LateUpdate()
        {
            if (aimSource == null)
            {
                return;
            }

            _transform.position = aimSource.position + aimSource.TransformDirection(handOffset);

            if (enableLag)
            {
                float t = 1f - Mathf.Exp(-lagSpeed * Time.deltaTime);
                _transform.rotation = Quaternion.Slerp(_transform.rotation, aimSource.rotation, t);
            }
            else
            {
                _transform.rotation = aimSource.rotation;
            }
        }

        public void Toggle()
        {
            SetOn(!_isOn, playSound: true);
        }

        public void SetOn(bool value, bool playSound = true)
        {
            _isOn = value;
            spotLight.enabled = value;
            spotLight.intensity = _baseIntensity;

            if (playSound && audioSource != null && clickClip != null)
            {
                audioSource.PlayOneShot(clickClip);
            }
        }

        /// <summary>電池ギミックなど外部から明るさ基準を変えたいとき用</summary>
        public void SetBaseIntensity(float intensity)
        {
            _baseIntensity = Mathf.Max(0f, intensity);
            if (_isOn && !enableFlicker)
            {
                spotLight.intensity = _baseIntensity;
            }
        }
    }
}
