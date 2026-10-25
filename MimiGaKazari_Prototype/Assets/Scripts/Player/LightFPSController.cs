using UnityEngine;

namespace MimiHorror.Player
{
    /// <summary>
    /// 超軽量・一人称探索コントローラー
    /// - CharacterController のみ使用（Rigidbody なし）
    /// - GetComponent は Awake でキャッシュし、Update では一切呼ばない
    /// - 移動は SmoothDamp で滑らかにし、スタッターを防ぐ
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class LightFPSController : MonoBehaviour
    {
        [Header("参照（Player Rig Builder で自動設定されます）")]
        [Tooltip("上下の視点回転（Pitch）を担当する Transform。通常は CameraHolder")]
        [SerializeField] private Transform cameraHolder;

        [Tooltip("ヘッドボブで上下させる Transform。通常は Main Camera 本体")]
        [SerializeField] private Transform bobTarget;

        [Header("移動")]
        [SerializeField] private float walkSpeed = 2.2f;
        [SerializeField] private float runSpeed = 3.8f;
        [Tooltip("大きいほどキビキビ、小さいほどヌルヌル動き出す")]
        [SerializeField] private float accelerationTime = 0.12f;
        [SerializeField] private float gravity = -18f;
        [Tooltip("地面に張り付けるための下向き速度。段差を降りるときの浮き防止")]
        [SerializeField] private float groundedStickForce = -2f;

        [Header("視点")]
        [Tooltip("マウスの物理移動量に対する感度。1.0〜2.5 が目安")]
        [SerializeField] private float mouseSensitivity = 1.7f;
        [SerializeField] private float minPitch = -85f;
        [SerializeField] private float maxPitch = 85f;
        [SerializeField] private bool invertY = false;
        [SerializeField] private bool lockCursorOnStart = true;

        [Header("ヘッドボブ（歩行揺れ）")]
        [SerializeField] private bool enableHeadBob = true;
        [SerializeField] private float bobAmplitude = 0.022f;
        [SerializeField] private float bobFrequency = 7f;

        private CharacterController _controller;
        private Transform _transform;

        private Vector3 _horizontalVelocity;
        private Vector3 _smoothDampVelocity;
        private float _verticalVelocity;
        private float _pitch;
        private float _bobTimer;
        private Vector3 _bobBaseLocalPosition;
        private bool _controlEnabled = true;

        /// <summary>現在歩いているか（足音・演出用）</summary>
        public bool IsMoving { get; private set; }

        /// <summary>現在ダッシュ中か（息遣い演出などに使える）</summary>
        public bool IsRunning { get; private set; }

        /// <summary>現在の水平速度の大きさ m/s</summary>
        public float CurrentSpeed => _horizontalVelocity.magnitude;

        private void Awake()
        {
            // 重い取得処理はここで一度だけ行いキャッシュする
            _controller = GetComponent<CharacterController>();
            _transform = transform;

            if (cameraHolder == null)
            {
                Debug.LogError("[LightFPSController] cameraHolder が未設定です。Inspector で CameraHolder を割り当ててください。", this);
                enabled = false;
                return;
            }

            if (bobTarget == null)
            {
                bobTarget = cameraHolder;
            }

            _bobBaseLocalPosition = bobTarget.localPosition;
            _pitch = cameraHolder.localEulerAngles.x;
            if (_pitch > 180f) _pitch -= 360f;
        }

        private void Start()
        {
            if (lockCursorOnStart)
            {
                LockCursor(true);
            }
        }

        private void Update()
        {
            HandleCursorLock();

            if (!_controlEnabled || Cursor.lockState != CursorLockMode.Locked)
            {
                // 操作無効中も重力だけはかけ続けて浮遊を防ぐ
                ApplyGravityAndMove(Vector3.zero, Time.deltaTime);
                IsMoving = false;
                IsRunning = false;
                return;
            }

            HandleLook();
            HandleMove(Time.deltaTime);
        }

        /// <summary>イベントシーンやUI表示中などに操作を止めたいときに呼ぶ</summary>
        public void SetControlEnabled(bool value)
        {
            _controlEnabled = value;
            LockCursor(value);
        }

        private void HandleCursorLock()
        {
            // Esc で解除されるのは Unity / OS 側の仕様。クリックで再ロックする
            if (_controlEnabled && Cursor.lockState != CursorLockMode.Locked && Input.GetMouseButtonDown(0))
            {
                LockCursor(true);
            }
        }

        private static void LockCursor(bool locked)
        {
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        private void HandleLook()
        {
            // GetAxisRaw（＝マウス移動量そのもの）に deltaTime を掛けないのが正解。
            // 掛けるとフレームレートで感度が変わってしまう。
            float mouseX = Input.GetAxisRaw("Mouse X") * mouseSensitivity;
            float mouseY = Input.GetAxisRaw("Mouse Y") * mouseSensitivity;

            _transform.Rotate(Vector3.up, mouseX, Space.Self);

            _pitch += invertY ? mouseY : -mouseY;
            _pitch = Mathf.Clamp(_pitch, minPitch, maxPitch);
            cameraHolder.localRotation = Quaternion.Euler(_pitch, 0f, 0f);
        }

        private void HandleMove(float deltaTime)
        {
            float inputX = Input.GetAxisRaw("Horizontal"); // A / D
            float inputZ = Input.GetAxisRaw("Vertical");   // W / S

            Vector3 wishDirection = (_transform.right * inputX) + (_transform.forward * inputZ);

            // 斜め移動だけ速くならないよう、長さが 1 を超えたときだけ正規化する
            if (wishDirection.sqrMagnitude > 1f)
            {
                wishDirection.Normalize();
            }

            bool hasInput = wishDirection.sqrMagnitude > 0.0001f;
            IsRunning = hasInput && (Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift));

            float targetSpeed = IsRunning ? runSpeed : walkSpeed;
            Vector3 wishVelocity = wishDirection * targetSpeed;

            // 急加速・急停止のガタつきを SmoothDamp で消す（割り当てなし）
            _horizontalVelocity = Vector3.SmoothDamp(
                _horizontalVelocity,
                wishVelocity,
                ref _smoothDampVelocity,
                accelerationTime);

            IsMoving = _horizontalVelocity.sqrMagnitude > 0.04f;

            ApplyGravityAndMove(_horizontalVelocity, deltaTime);
            UpdateHeadBob(deltaTime);
        }

        private void ApplyGravityAndMove(Vector3 horizontalVelocity, float deltaTime)
        {
            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = groundedStickForce;
            }
            else
            {
                _verticalVelocity += gravity * deltaTime;
            }

            Vector3 velocity = horizontalVelocity;
            velocity.y = _verticalVelocity;

            // CharacterController.Move は Update で呼ぶのが Unity の推奨。
            // FixedUpdate で呼ぶと描画とズレてカクつく原因になる。
            _controller.Move(velocity * deltaTime);
        }

        private void UpdateHeadBob(float deltaTime)
        {
            if (!enableHeadBob || bobTarget == null)
            {
                return;
            }

            if (IsMoving && _controller.isGrounded)
            {
                float speedRatio = CurrentSpeed / Mathf.Max(walkSpeed, 0.01f);
                _bobTimer += deltaTime * bobFrequency * speedRatio;

                float offsetY = Mathf.Sin(_bobTimer) * bobAmplitude;
                float offsetX = Mathf.Cos(_bobTimer * 0.5f) * bobAmplitude * 0.5f;

                bobTarget.localPosition = _bobBaseLocalPosition + new Vector3(offsetX, offsetY, 0f);
            }
            else
            {
                // 止まったら元の位置へゆっくり戻す
                bobTarget.localPosition = Vector3.Lerp(
                    bobTarget.localPosition,
                    _bobBaseLocalPosition,
                    1f - Mathf.Exp(-8f * deltaTime));
            }
        }
    }
}
